"""FastAPI backend for MMM Dashboard."""

from pathlib import Path

from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any, Tuple
import pandas as pd
import numpy as np
import io
import json
from datetime import datetime
from scipy import stats
from scipy.optimize import minimize_scalar
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.tsa.stattools import adfuller, acf


def clean_for_json(obj):
    """Clean object for JSON serialization, handling NaN/Inf values."""
    if isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_for_json(v) for v in obj]
    elif isinstance(obj, (bool, np.bool_)):
        return bool(obj)
    elif isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return obj
    elif isinstance(obj, np.floating):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.ndarray):
        return clean_for_json(obj.tolist())
    else:
        return obj

# Import core modules
from backend.core import (
    geometric_adstock,
    geometric_adstock_matrix,
    hill_function,
    hill_function_scaled,
    log_transform,
    inverse_log_transform,
    build_loglog_model,
    build_lift_model,
    fit_model,
    compute_model_diagnostics,
    compute_channel_contributions_loglog,
    compute_shapley_values,
    calculate_roi,
    optimize_budget_marginal_roi,
    calculate_expected_lift,
    create_scenario,
    compare_scenarios,
)


# ============================================================================
# DATA QUALITY AND ANALYSIS FUNCTIONS
# ============================================================================

DATE_FORMATS = [
    ('%Y-%m-%d', 'YYYY-MM-DD'),
    ('%d/%m/%Y', 'DD/MM/YYYY'),
    ('%m/%d/%Y', 'MM/DD/YYYY'),
    ('%Y/%m/%d', 'YYYY/MM/DD'),
    ('%d-%m-%Y', 'DD-MM-YYYY'),
    ('%m-%d-%Y', 'MM-DD-YYYY'),
    ('%Y%m%d', 'YYYYMMDD'),
    ('%d.%m.%Y', 'DD.MM.YYYY'),
    ('%B %d, %Y', 'Month DD, YYYY'),
    ('%b %d, %Y', 'Mon DD, YYYY'),
    ('%d %B %Y', 'DD Month YYYY'),
    ('%Y-%m-%d %H:%M:%S', 'YYYY-MM-DD HH:MM:SS'),
]


def detect_date_format(series: pd.Series) -> Dict[str, Any]:
    """Detect date format with confidence score."""
    sample = series.dropna().head(100).astype(str)
    if len(sample) == 0:
        return {'detected_format': None, 'display_format': None, 'confidence': 0, 'sample_parsed': []}

    best_format = None
    best_display = None
    best_count = 0

    for fmt, display in DATE_FORMATS:
        count = 0
        for val in sample:
            try:
                datetime.strptime(str(val).strip(), fmt)
                count += 1
            except (ValueError, TypeError):
                pass
        if count > best_count:
            best_count = count
            best_format = fmt
            best_display = display

    # Try pandas auto-detection as fallback
    if best_count == 0:
        try:
            parsed = pd.to_datetime(sample, infer_datetime_format=True)
            if parsed.notna().sum() > len(sample) * 0.8:
                return {
                    'detected_format': 'auto',
                    'display_format': 'Auto-detected',
                    'confidence': round(parsed.notna().sum() / len(sample) * 100, 1),
                    'sample_parsed': parsed.dropna().head(5).dt.strftime('%Y-%m-%d').tolist()
                }
        except Exception:
            pass

    confidence = round(best_count / len(sample) * 100, 1) if len(sample) > 0 else 0

    # Parse sample dates
    sample_parsed = []
    if best_format:
        for val in sample.head(5):
            try:
                dt = datetime.strptime(str(val).strip(), best_format)
                sample_parsed.append(dt.strftime('%Y-%m-%d'))
            except (ValueError, TypeError):
                sample_parsed.append(None)

    return {
        'detected_format': best_format,
        'display_format': best_display,
        'confidence': confidence,
        'sample_parsed': sample_parsed
    }


def compute_data_quality(df: pd.DataFrame) -> Dict[str, Any]:
    """Compute comprehensive data quality metrics."""
    quality = {
        'columns': {},
        'summary': {
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'total_missing': int(df.isna().sum().sum()),
            'total_duplicates': int(df.duplicated().sum()),
            'memory_usage_mb': round(df.memory_usage(deep=True).sum() / 1024 / 1024, 2)
        }
    }

    for col in df.columns:
        col_data = df[col]
        col_quality = {
            'dtype': str(col_data.dtype),
            'missing_count': int(col_data.isna().sum()),
            'missing_pct': round(col_data.isna().sum() / len(df) * 100, 2),
        }

        if pd.api.types.is_numeric_dtype(col_data):
            non_null = col_data.dropna()
            col_quality.update({
                'zero_count': int((non_null == 0).sum()),
                'negative_count': int((non_null < 0).sum()),
                'mean': float(non_null.mean()) if len(non_null) > 0 else None,
                'std': float(non_null.std()) if len(non_null) > 0 else None,
                'min': float(non_null.min()) if len(non_null) > 0 else None,
                'max': float(non_null.max()) if len(non_null) > 0 else None,
                'median': float(non_null.median()) if len(non_null) > 0 else None,
            })

            # Outlier detection using IQR
            if len(non_null) > 4:
                Q1 = non_null.quantile(0.25)
                Q3 = non_null.quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                outliers = ((non_null < lower_bound) | (non_null > upper_bound)).sum()
                col_quality['outlier_count'] = int(outliers)
                col_quality['outlier_bounds'] = {'lower': float(lower_bound), 'upper': float(upper_bound)}
            else:
                col_quality['outlier_count'] = 0
                col_quality['outlier_bounds'] = None
        else:
            col_quality['unique_count'] = int(col_data.nunique())
            col_quality['top_values'] = col_data.value_counts().head(5).to_dict()

        quality['columns'][col] = col_quality

    return quality


def compute_vif(df: pd.DataFrame, columns: List[str]) -> Dict[str, float]:
    """Compute Variance Inflation Factor for multicollinearity detection."""
    if len(columns) < 2:
        return {}

    # Filter to numeric columns only and drop NaN
    numeric_df = df[columns].select_dtypes(include=[np.number]).dropna()

    if len(numeric_df) < 10 or len(numeric_df.columns) < 2:
        return {}

    vif_data = {}
    X = numeric_df.values

    for i, col in enumerate(numeric_df.columns):
        try:
            vif = variance_inflation_factor(X, i)
            vif_data[col] = round(float(vif), 2) if not np.isinf(vif) else 999.99
        except Exception:
            vif_data[col] = None

    return vif_data


def compute_correlation_report(df: pd.DataFrame, threshold: float = 0.7) -> Dict[str, Any]:
    """Generate correlation analysis report with VIF and recommendations."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    if len(numeric_cols) < 2:
        return {'high_correlations': [], 'vif': {}, 'recommendations': []}

    corr_matrix = df[numeric_cols].corr()

    # Find high correlations
    high_correlations = []
    for i, col1 in enumerate(numeric_cols):
        for j, col2 in enumerate(numeric_cols):
            if i < j:  # Upper triangle only
                corr_val = corr_matrix.loc[col1, col2]
                if abs(corr_val) >= threshold:
                    high_correlations.append({
                        'column1': col1,
                        'column2': col2,
                        'correlation': round(float(corr_val), 3),
                        'severity': 'high' if abs(corr_val) >= 0.85 else 'moderate'
                    })

    # Sort by absolute correlation
    high_correlations.sort(key=lambda x: abs(x['correlation']), reverse=True)

    # Compute VIF
    vif = compute_vif(df, numeric_cols)

    # Generate recommendations
    recommendations = []
    for hc in high_correlations[:5]:  # Top 5 high correlations
        if hc['severity'] == 'high':
            recommendations.append(
                f"Consider combining {hc['column1']} and {hc['column2']} (r={hc['correlation']:.2f}) or using one as control"
            )

    high_vif_cols = [col for col, v in vif.items() if v and v > 5]
    for col in high_vif_cols[:3]:
        recommendations.append(f"{col} has high VIF ({vif[col]}) - potential multicollinearity issue")

    return {
        'high_correlations': high_correlations,
        'vif': vif,
        'recommendations': recommendations
    }


def run_stationarity_test(series: pd.Series) -> Dict[str, Any]:
    """Run Augmented Dickey-Fuller test for stationarity."""
    clean_series = series.dropna()

    if len(clean_series) < 20:
        return {
            'stationary': None,
            'adf_statistic': None,
            'p_value': None,
            'critical_values': {},
            'message': 'Insufficient data for stationarity test (need at least 20 observations)'
        }

    try:
        result = adfuller(clean_series, autolag='AIC')
        adf_stat, p_value, usedlag, nobs, critical_values, icbest = result

        is_stationary = p_value < 0.05

        return {
            'stationary': is_stationary,
            'adf_statistic': round(float(adf_stat), 4),
            'p_value': round(float(p_value), 4),
            'critical_values': {k: round(float(v), 4) for k, v in critical_values.items()},
            'used_lag': int(usedlag),
            'n_obs': int(nobs),
            'message': 'Stationary - suitable for modeling' if is_stationary else 'Non-stationary - consider differencing or detrending'
        }
    except Exception as e:
        return {
            'stationary': None,
            'adf_statistic': None,
            'p_value': None,
            'critical_values': {},
            'message': f'Error running stationarity test: {str(e)}'
        }


def create_feature_engineering_preview(df: pd.DataFrame, columns: List[str], operations: Dict) -> Dict[str, Any]:
    """Preview feature engineering transformations."""
    preview = {'columns': {}, 'new_column_count': 0}

    for col in columns:
        if col not in df.columns or not pd.api.types.is_numeric_dtype(df[col]):
            continue

        col_preview = {}
        series = df[col].fillna(0)

        # Lag features
        if operations.get('lags'):
            for lag in [1, 2, 4]:
                new_col = f"{col}_lag{lag}"
                col_preview[new_col] = series.shift(lag).head(10).tolist()
                preview['new_column_count'] += 1

        # Rolling averages
        if operations.get('rolling'):
            for window in [4, 8]:
                new_col = f"{col}_ma{window}"
                col_preview[new_col] = series.rolling(window=window, min_periods=1).mean().head(10).tolist()
                preview['new_column_count'] += 1

        # Log transform
        if operations.get('log'):
            new_col = f"{col}_log"
            col_preview[new_col] = np.log1p(series.clip(lower=0)).head(10).tolist()
            preview['new_column_count'] += 1

        preview['columns'][col] = col_preview

    return preview


def compute_holdout_metrics(
    df_holdout: pd.DataFrame,
    media_cols: List[str],
    target_col: str,
    trace,
    decay_rates: Dict[str, float],
    saturation_params: Dict[str, Any],
    config: Dict,
    n_train: int,
    control_cols: List[str] = None,
    event_names: List[str] = None,
    X_media_means: np.ndarray = None
) -> Dict[str, Any]:
    """Compute metrics on holdout data for model validation.

    Includes all model components: media, trend, seasonality, events, controls.
    """
    try:
        y_holdout = df_holdout[target_col].values
        X_media_holdout = df_holdout[media_cols].values
        n_holdout = len(y_holdout)

        # Apply same transformations to media
        X_transformed = X_media_holdout.copy()
        for i, col in enumerate(media_cols):
            if decay_rates.get(col, 0) > 0:
                X_transformed[:, i] = geometric_adstock(
                    X_media_holdout[:, i],
                    decay_rate=decay_rates[col],
                    normalize=True
                )
            if saturation_params.get(col):
                K = saturation_params[col]['K']
                S = saturation_params[col]['S']
                max_val = X_transformed[:, i].max()
                X_transformed[:, i] = hill_function_scaled(X_transformed[:, i], K, S, max_val)

        # Scale media by training means (same as training)
        if X_media_means is not None:
            X_transformed = X_transformed / (X_media_means + 1e-8)

        # Get posterior means
        posterior = trace.posterior
        betas = posterior['beta'].values.mean(axis=(0, 1))
        intercept = posterior['intercept'].values.mean()

        # Start with intercept + media contribution
        X_media_log = log_transform(X_transformed)
        y_pred_log = intercept + np.dot(X_media_log, betas)

        # Add trend component (continuation from training)
        if 'gamma_trend' in posterior:
            gamma_trend = posterior['gamma_trend'].values.mean()
            trend_type = config.get('trend_type', 'linear')
            total_periods = n_train + n_holdout
            t = np.arange(n_train, total_periods)  # Holdout indices

            if trend_type == 'none':
                holdout_trend = np.zeros(n_holdout)
            elif trend_type == 'linear':
                holdout_trend = t / total_periods
            elif trend_type == 'log':
                holdout_trend = np.log1p(t) / np.log1p(total_periods)
            elif trend_type == 'quadratic':
                holdout_trend = (t / total_periods) ** 2
            else:
                holdout_trend = t / total_periods

            # Normalize to max 1
            if holdout_trend.max() > 0:
                holdout_trend = holdout_trend / holdout_trend.max()

            y_pred_log = y_pred_log + gamma_trend * holdout_trend

        # Add seasonality component (Fourier features for holdout dates)
        if 'gamma_fourier' in posterior:
            gamma_fourier = posterior['gamma_fourier'].values.mean(axis=(0, 1))
            period = config.get('seasonality_period', 52)
            harmonics = 3

            # Create Fourier features for holdout period (continuing from training)
            total_periods = n_train + n_holdout
            t_holdout = np.arange(n_train, total_periods)
            X_fourier_holdout = []
            for k in range(1, harmonics + 1):
                X_fourier_holdout.append(np.sin(2 * np.pi * k * t_holdout / period))
                X_fourier_holdout.append(np.cos(2 * np.pi * k * t_holdout / period))
            X_fourier_holdout = np.column_stack(X_fourier_holdout)

            y_pred_log = y_pred_log + np.dot(X_fourier_holdout, gamma_fourier)

        # Add controls component
        if control_cols and 'gamma_controls' in posterior:
            valid_control_cols = [c for c in control_cols if c in df_holdout.columns]
            if valid_control_cols:
                gamma_controls = posterior['gamma_controls'].values.mean(axis=(0, 1))
                X_controls_holdout = df_holdout[valid_control_cols].fillna(0).values
                # Standardize (should use training mean/std ideally, but approximate)
                X_controls_holdout = (X_controls_holdout - X_controls_holdout.mean(axis=0)) / (X_controls_holdout.std(axis=0) + 1e-8)
                if len(gamma_controls) == X_controls_holdout.shape[1]:
                    y_pred_log = y_pred_log + np.dot(X_controls_holdout, gamma_controls)

        # Add events component
        if event_names and 'gamma_events' in posterior:
            gamma_events = posterior['gamma_events'].values.mean(axis=(0, 1))
            event_matrix = []
            for event_name in event_names:
                if event_name in df_holdout.columns:
                    event_col = df_holdout[event_name].fillna(0).values
                else:
                    event_col = np.zeros(n_holdout)
                event_matrix.append(event_col)
            if event_matrix:
                X_events_holdout = np.column_stack(event_matrix)
                if len(gamma_events) == X_events_holdout.shape[1]:
                    y_pred_log = y_pred_log + np.dot(X_events_holdout, gamma_events)

        # Convert from log-space to original scale
        y_pred = np.exp(y_pred_log) - 1

        # Calculate metrics
        mape = np.mean(np.abs((y_holdout - y_pred) / y_holdout)) * 100
        rmse = np.sqrt(np.mean((y_holdout - y_pred) ** 2))
        mae = np.mean(np.abs(y_holdout - y_pred))

        # R-squared on holdout
        ss_res = np.sum((y_holdout - y_pred) ** 2)
        ss_tot = np.sum((y_holdout - y_holdout.mean()) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

        return {
            'mape': float(mape),
            'rmse': float(rmse),
            'mae': float(mae),
            'r_squared': float(r_squared),
            'n_periods': len(y_holdout),
            'actual_mean': float(y_holdout.mean()),
            'predicted_mean': float(y_pred.mean()),
        }
    except Exception as e:
        return {'error': str(e)}


def compute_residual_analysis(y: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
    """Compute residual analysis metrics."""
    residuals = y - y_pred

    # Basic stats
    residual_mean = float(residuals.mean())
    residual_std = float(residuals.std())

    # Normality test (Shapiro-Wilk)
    if len(residuals) >= 20:
        stat, p_value = stats.shapiro(residuals[:min(len(residuals), 5000)])
        normality_test = {
            'statistic': float(stat),
            'p_value': float(p_value),
            'is_normal': p_value > 0.05
        }
    else:
        normality_test = None

    # Autocorrelation
    try:
        acf_values = acf(residuals, nlags=min(10, len(residuals) - 1), fft=True)
        autocorrelation = acf_values.tolist()
    except Exception:
        autocorrelation = []

    # Durbin-Watson statistic
    dw_stat = None
    if len(residuals) > 1:
        diff = np.diff(residuals)
        dw_stat = float(np.sum(diff ** 2) / np.sum(residuals ** 2))

    # Residual histogram data
    hist, bin_edges = np.histogram(residuals, bins=20)
    histogram = {
        'counts': hist.tolist(),
        'bin_edges': bin_edges.tolist()
    }

    return {
        'mean': residual_mean,
        'std': residual_std,
        'normality_test': normality_test,
        'autocorrelation': autocorrelation,
        'durbin_watson': dw_stat,
        'histogram': histogram,
        'residuals': residuals.tolist(),
    }


def compute_response_curves(
    media_cols: List[str],
    elasticities: Dict[str, float],
    current_spend: Dict[str, float],
    saturation_params: Dict[str, Any],
    current_contributions: Dict[str, float] = None,
    n_points: int = 50
) -> Dict[str, List[Dict]]:
    """Compute response curves for each channel.

    Response curve shows expected sales contribution at different spend levels.
    Marginal ROI shows the return on the next dollar spent (dSales/dSpend).
    """
    response_curves = {}

    for col in media_cols:
        elasticity = elasticities.get(col, 0.1)
        curr_spend = current_spend.get(col, 1)
        curr_contrib = current_contributions.get(col, curr_spend * 2) if current_contributions else curr_spend * 2
        sat_params = saturation_params.get(col)

        # Generate spend range from 0 to 3x current spend
        max_spend = max(curr_spend * 3, 1000)
        spend_range = np.linspace(max_spend * 0.01, max_spend, n_points)  # Start from 1% to avoid division issues

        # Find the index of the point closest to current spend
        closest_idx = int(np.argmin(np.abs(spend_range - curr_spend)))

        curve_data = []
        for i, spend in enumerate(spend_range):
            if sat_params and sat_params.get('K', 0) > 0:
                # With saturation (Hill function)
                K, S = sat_params['K'], sat_params['S']
                # Response at this spend level (scaled to match current contribution)
                sat_current = hill_function(np.array([curr_spend]), K, S)[0]
                sat_at_spend = hill_function(np.array([spend]), K, S)[0]

                if sat_current > 0:
                    response = curr_contrib * (sat_at_spend / sat_current)
                else:
                    response = 0

                # Marginal ROI = derivative of Hill function * scaling factor
                # d/dx [x^S / (K^S + x^S)] = S * K^S * x^(S-1) / (K^S + x^S)^2
                eps = max(spend * 0.001, 0.1)
                sat_plus = hill_function(np.array([spend + eps]), K, S)[0]
                d_sat = (sat_plus - sat_at_spend) / eps

                # Scale to get actual marginal ROI ($ sales per $ spend)
                if sat_current > 0:
                    marginal_roi = d_sat * (curr_contrib / sat_current)
                else:
                    marginal_roi = 0
            else:
                # Log-log model without saturation
                # Sales = A * spend^elasticity, where A is calibrated to current
                # At current spend: curr_contrib = A * curr_spend^elasticity
                # So A = curr_contrib / curr_spend^elasticity

                if curr_spend > 0:
                    A = curr_contrib / (curr_spend ** elasticity)
                    response = A * (spend ** elasticity)
                    # Marginal ROI = d(Sales)/d(Spend) = A * elasticity * spend^(elasticity-1)
                    #              = elasticity * Sales / Spend
                    marginal_roi = elasticity * response / spend if spend > 0 else elasticity * A
                else:
                    response = 0
                    marginal_roi = 0

            curve_data.append({
                'spend': float(spend),
                'response': float(response),
                'marginalRoi': float(marginal_roi),
                'isCurrent': i == closest_idx
            })

        response_curves[col] = curve_data

    return response_curves

app = FastAPI(
    title="MMMpact API",
    description="Marketing Mix Modeling Backend API",
    version="1.0.0",
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handler to log errors with traceback
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    import traceback
    error_trace = traceback.format_exc()
    print(f"ERROR in {request.url.path}: {exc}")
    print(error_trace)
    return JSONResponse(
        status_code=500,
        content={"detail": f"{str(exc)}\n{error_trace}"}
    )

# In-memory storage for session data (would use Redis/DB in production)
session_data: Dict[str, Any] = {}


# Pydantic models for request/response
class ColumnMapping(BaseModel):
    date_col: str
    target_col: str
    media_cols: List[str]
    control_cols: Optional[List[str]] = []


# Channel-specific adstock configuration
class AdstockConfig(BaseModel):
    enabled: bool = True
    decay_rate: float = Field(default=0.3, ge=0.0, le=0.99)
    max_carryover: int = Field(default=8, ge=1, le=52)


# Channel-specific saturation configuration
class SaturationConfig(BaseModel):
    enabled: bool = True
    K: float = Field(default=50000, gt=0)  # Half-saturation point
    S: float = Field(default=1.5, ge=0.5, le=5.0)  # Shape parameter


# Channel-specific prior configuration
class PriorConfig(BaseModel):
    prior_type: str = "halfnormal"  # "halfnormal", "normal", "lognormal"
    sigma: float = Field(default=0.3, gt=0)
    lower_bound: float = Field(default=0.0, ge=0)
    upper_bound: float = Field(default=2.0, ge=0)


# Custom event for holidays/promotions
class CustomEvent(BaseModel):
    name: str
    start_date: str  # ISO format YYYY-MM-DD
    end_date: str    # ISO format YYYY-MM-DD
    effect_type: str = "additive"  # "additive" or "multiplicative"


class ModelConfig(BaseModel):
    model_type: str = "loglog"  # "loglog" or "lift"
    seasonality_period: int = 52
    fourier_harmonics: int = 3
    mcmc_draws: int = 2000
    mcmc_tune: int = 1000
    mcmc_chains: int = 4
    # Extended configuration
    trend_type: str = "linear"  # "none", "linear", "log", "quadratic"
    seasonality_enabled: bool = True
    # Per-channel configurations (channel_name -> config)
    adstock_config: Optional[Dict[str, AdstockConfig]] = None
    saturation_config: Optional[Dict[str, SaturationConfig]] = None
    prior_config: Optional[Dict[str, PriorConfig]] = None
    # Custom events
    custom_events: Optional[List[CustomEvent]] = None
    # Holdout validation
    holdout_weeks: int = 0  # 0 = no holdout
    # Control variable usage
    use_controls: bool = True


class OptimizationRequest(BaseModel):
    total_budget: float
    constraints: Optional[Dict[str, tuple]] = None


class DataQualityAction(BaseModel):
    column: str
    action: str  # "fill_mean", "fill_median", "fill_zero", "drop_rows", "cap_outliers"


class FeatureEngineeringRequest(BaseModel):
    columns: List[str]
    operations: Dict[str, bool]  # {"lags": True, "rolling": True, "log": True}


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "1.0.0"}


class ScenarioRequest(BaseModel):
    name: str
    spend_allocation: Dict[str, float]


# Helper functions
def detect_column_types(df: pd.DataFrame) -> Dict[str, List[str]]:
    """Auto-detect column types based on content and naming patterns."""
    date_hints = ['date', 'week', 'month', 'day', 'time', 'period']
    target_hints = ['sales', 'revenue', 'conversions', 'kpi', 'target', 'y', 'outcome']
    spend_hints = ['spend', 'cost', 'budget', 'investment', 'media', 'channel', 'ad']

    result = {
        'date': [],
        'numeric': [],
        'categorical': [],
        'potential_target': [],
        'potential_media': [],
    }

    for col in df.columns:
        col_lower = col.lower()

        # Check for date columns
        if df[col].dtype == 'object':
            try:
                pd.to_datetime(df[col])
                result['date'].append(col)
                continue
            except (ValueError, TypeError):
                pass

        if pd.api.types.is_datetime64_any_dtype(df[col]):
            result['date'].append(col)
            continue

        if any(hint in col_lower for hint in date_hints):
            result['date'].append(col)
            continue

        # Check for numeric columns
        if pd.api.types.is_numeric_dtype(df[col]):
            result['numeric'].append(col)

            if any(hint in col_lower for hint in target_hints):
                result['potential_target'].append(col)
            elif any(hint in col_lower for hint in spend_hints):
                result['potential_media'].append(col)

        elif df[col].dtype == 'object' or pd.api.types.is_categorical_dtype(df[col]):
            result['categorical'].append(col)

    return result


def create_fourier_features(n_periods: int, period: int = 52, harmonics: int = 3) -> np.ndarray:
    """Create Fourier features for seasonality."""
    t = np.arange(n_periods)
    features = []
    for k in range(1, harmonics + 1):
        features.append(np.sin(2 * np.pi * k * t / period))
        features.append(np.cos(2 * np.pi * k * t / period))
    return np.column_stack(features)


# API Endpoints

@app.get("/")
async def root():
    return {"status": "ok", "message": "MMMpact API"}


@app.post("/api/upload")
async def upload_data(file: UploadFile):
    """Upload and parse a CSV or Excel file."""
    try:
        contents = await file.read()
        filename = file.filename.lower()

        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")

        # Store in session
        session_data['df'] = df
        session_data['filename'] = file.filename

        # Return summary
        column_types = detect_column_types(df)
        preview = df.head(10).fillna("").to_dict(orient='records')

        return clean_for_json({
            "success": True,
            "filename": file.filename,
            "rows": len(df),
            "columns": len(df.columns),
            "column_names": df.columns.tolist(),
            "column_types": column_types,
            "preview": preview,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sample-data/{sample_name}")
async def load_sample_data(sample_name: str):
    """Load a sample dataset."""
    sample_files = {
        "demo": Path(__file__).parent.parent / "mmm_weekly_clean.csv",
    }

    if sample_name not in sample_files:
        raise HTTPException(status_code=404, detail=f"Unknown sample: {sample_name}")

    file_path = sample_files[sample_name]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Sample file not found")

    df = pd.read_csv(file_path)
    session_data['df'] = df
    session_data['filename'] = sample_name

    column_types = detect_column_types(df)

    # Clean NaN values for JSON serialization
    preview = df.head(10).fillna("").to_dict(orient='records')

    return clean_for_json({
        "success": True,
        "filename": sample_name,
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": df.columns.tolist(),
        "column_types": column_types,
        "preview": preview,
    })


@app.get("/api/data/explore")
async def explore_data():
    """Get data exploration statistics with comprehensive quality metrics."""
    if 'df' not in session_data:
        raise HTTPException(status_code=400, detail="No data loaded")

    df = session_data['df']
    mapping = session_data.get('mapping', {})

    # Basic stats
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    # Get date range
    date_col = mapping.get('date_col')
    date_range = None
    detected_date_info = None
    if date_col and date_col in df.columns:
        try:
            dates = pd.to_datetime(df[date_col])
            date_range = {
                "start": dates.min().strftime('%Y-%m-%d'),
                "end": dates.max().strftime('%Y-%m-%d'),
            }
            detected_date_info = detect_date_format(df[date_col])
        except Exception:
            pass
    else:
        # Try to find a date column automatically
        for col in df.columns:
            try:
                if df[col].dtype == 'object':
                    dates = pd.to_datetime(df[col])
                    date_range = {
                        "start": dates.min().strftime('%Y-%m-%d'),
                        "end": dates.max().strftime('%Y-%m-%d'),
                    }
                    detected_date_info = detect_date_format(df[col])
                    break
            except Exception:
                continue

    # Calculate missing percentage
    total_cells = df.size
    missing_cells = df.isna().sum().sum()
    missing_pct = (missing_cells / total_cells) * 100 if total_cells > 0 else 0

    # Summary stats
    summary = {
        "rows": len(df),
        "columns": len(df.columns),
        "date_range": date_range,
        "missing_pct": missing_pct,
    }

    # Comprehensive data quality
    data_quality = compute_data_quality(df)

    # Column stats
    column_stats = {}
    for col in df.columns:
        col_stats = {
            "dtype": str(df[col].dtype),
            "non_null": int(df[col].notna().sum()),
            "null_count": int(df[col].isna().sum()),
            "null_pct": round(df[col].isna().sum() / len(df) * 100, 2),
        }
        if pd.api.types.is_numeric_dtype(df[col]):
            non_null = df[col].dropna()
            col_stats["mean"] = float(non_null.mean()) if len(non_null) > 0 else None
            col_stats["std"] = float(non_null.std()) if len(non_null) > 0 else None
            col_stats["min"] = float(non_null.min()) if len(non_null) > 0 else None
            col_stats["max"] = float(non_null.max()) if len(non_null) > 0 else None
            col_stats["median"] = float(non_null.median()) if len(non_null) > 0 else None
            col_stats["zero_count"] = int((non_null == 0).sum())
            col_stats["negative_count"] = int((non_null < 0).sum())
            # Outlier detection
            if len(non_null) > 4:
                Q1, Q3 = non_null.quantile([0.25, 0.75])
                IQR = Q3 - Q1
                outliers = ((non_null < Q1 - 1.5 * IQR) | (non_null > Q3 + 1.5 * IQR)).sum()
                col_stats["outlier_count"] = int(outliers)
        column_stats[col] = col_stats

    # Correlation matrix for numeric columns
    correlations = {}
    if len(numeric_cols) > 1:
        corr_df = df[numeric_cols].corr()
        for col in numeric_cols:
            correlations[col] = {c: float(corr_df.loc[col, c]) if not np.isnan(corr_df.loc[col, c]) else 0 for c in numeric_cols}

    # Correlation report with VIF and recommendations
    correlation_report = compute_correlation_report(df)

    # Time series data (target variable over time)
    time_series = []
    target_col = mapping.get('target_col')
    if date_col and target_col and date_col in df.columns and target_col in df.columns:
        try:
            ts_df = df[[date_col, target_col]].copy()
            ts_df[date_col] = pd.to_datetime(ts_df[date_col])
            ts_df = ts_df.sort_values(date_col)
            time_series = [
                {"date": row[date_col].strftime('%Y-%m-%d'), "value": float(row[target_col])}
                for _, row in ts_df.iterrows()
                if pd.notna(row[target_col])
            ]
        except Exception:
            pass

    # Stationarity test on target variable if available
    stationarity = None
    if target_col and target_col in df.columns:
        stationarity = run_stationarity_test(df[target_col])

    return clean_for_json({
        "summary": summary,
        "column_stats": column_stats,
        "correlations": correlations,
        "correlation_report": correlation_report,
        "time_series": time_series,
        "data_quality": data_quality,
        "stationarity": stationarity,
        "date_detection": detected_date_info,
    })


@app.post("/api/mapping")
async def set_column_mapping(mapping: ColumnMapping):
    """Set the column mapping for modeling."""
    if 'df' not in session_data:
        raise HTTPException(status_code=400, detail="No data loaded")

    df = session_data['df']

    # Validate columns exist
    all_cols = [mapping.date_col, mapping.target_col] + mapping.media_cols + (mapping.control_cols or [])
    missing = [col for col in all_cols if col not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Columns not found: {missing}")

    session_data['mapping'] = mapping.dict()

    return {"success": True, "mapping": mapping.dict()}


@app.get("/api/mapping/suggest")
async def suggest_column_mapping():
    """Use heuristics to suggest column mappings based on column names and data types."""
    if 'df' not in session_data:
        raise HTTPException(status_code=400, detail="No data loaded")

    df = session_data['df']
    suggestions = {
        'date_col': None,
        'target_col': None,
        'media_cols': [],
        'control_cols': [],
        'confidence': {}
    }

    # Define patterns for each column type
    date_patterns = ['date', 'time', 'week', 'month', 'year', 'period', 'day', 'dt']
    target_patterns = ['sale', 'revenue', 'conversion', 'kpi', 'target', 'response', 'outcome', 'order', 'transaction', 'income', 'booking', 'purchase', 'total', 'gross', 'net', 'quantity', 'units', 'volume']
    media_patterns = ['spend', 'cost', 'media', 'channel', 'ad', 'advertising', 'marketing', 'campaign', 'impression', 'click', 'tv', 'radio', 'digital', 'social', 'search', 'display', 'video', 'facebook', 'google', 'meta', 'tiktok', 'youtube', 'paid', 'organic', 'budget']
    control_patterns = ['control', 'promo', 'promotion', 'discount', 'holiday', 'season', 'weather', 'temp', 'competitor', 'macro', 'gdp', 'cpi', 'unemployment', 'stock', 'inventory', 'distribution', 'event']
    # Note: 'price' removed from control patterns to avoid matching purchase price columns

    def match_patterns(col_name: str, patterns: List[str]) -> float:
        """Return a confidence score (0-1) for how well column matches patterns."""
        col_lower = col_name.lower().replace('_', ' ').replace('-', ' ')
        matches = sum(1 for p in patterns if p in col_lower)
        if matches > 0:
            return min(1.0, 0.5 + matches * 0.25)
        return 0.0

    def is_date_column(col: str) -> Tuple[bool, float]:
        """Check if column appears to be a date column."""
        pattern_score = match_patterns(col, date_patterns)

        # Check data type
        try:
            sample = df[col].dropna().head(100)
            if len(sample) == 0:
                return False, 0.0

            # If already datetime type
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                return True, 1.0

            # Try parsing as dates
            sample_str = sample.astype(str)
            parsed_count = 0
            for val in sample_str:
                for fmt, _ in DATE_FORMATS:
                    try:
                        datetime.strptime(val.strip(), fmt)
                        parsed_count += 1
                        break
                    except:
                        continue

            parse_ratio = parsed_count / len(sample)
            if parse_ratio > 0.8:
                return True, max(pattern_score, 0.8 + parse_ratio * 0.2)
        except:
            pass

        return pattern_score > 0.5, pattern_score

    def is_numeric_with_variance(col: str) -> bool:
        """Check if column is numeric with reasonable variance."""
        if not pd.api.types.is_numeric_dtype(df[col]):
            return False
        non_null = df[col].dropna()
        if len(non_null) < 10:
            return False
        # Has reasonable variance (not constant)
        return non_null.std() > 0.001 * non_null.mean() if non_null.mean() != 0 else non_null.std() > 0

    # Score each column
    column_scores = {}
    for col in df.columns:
        scores = {
            'date': 0.0,
            'target': 0.0,
            'media': 0.0,
            'control': 0.0
        }

        # Check date
        is_date, date_conf = is_date_column(col)
        if is_date:
            scores['date'] = date_conf

        # Check numeric patterns only for numeric columns
        if is_numeric_with_variance(col):
            scores['target'] = match_patterns(col, target_patterns)
            scores['media'] = match_patterns(col, media_patterns)
            scores['control'] = match_patterns(col, control_patterns)

            # If column matches media patterns but not spend/cost specifically, reduce media score
            col_lower = col.lower()
            has_spend_cost = 'spend' in col_lower or 'cost' in col_lower or 'budget' in col_lower
            if scores['media'] > 0 and not has_spend_cost:
                scores['media'] *= 0.5  # Reduce confidence if not explicitly spend/cost

            # If column matches target AND media, prioritize target (purchases > spend patterns)
            if scores['target'] > 0 and scores['media'] > 0:
                if has_spend_cost:
                    scores['target'] = 0  # It's clearly a spend column
                else:
                    scores['media'] = 0  # It's likely a target

            # Boost target score for high-value columns (likely revenue/sales)
            col_mean = df[col].mean()
            if col_mean > 1000:  # Likely a monetary value
                if scores['target'] > 0:
                    scores['target'] = min(1.0, scores['target'] + 0.1)

            # Boost target for columns that look like they might be the main KPI
            if any(kw in col_lower for kw in ['first_purchase', 'all_purchase', 'total_sale', 'revenue', 'conversion']):
                scores['target'] = max(scores['target'], 0.8)

        column_scores[col] = scores

    # Assign best matches
    # Date column (pick highest date score)
    date_candidates = [(col, scores['date']) for col, scores in column_scores.items() if scores['date'] > 0.3]
    if date_candidates:
        date_candidates.sort(key=lambda x: x[1], reverse=True)
        suggestions['date_col'] = date_candidates[0][0]
        suggestions['confidence']['date_col'] = date_candidates[0][1]

    # Target column (pick highest target score, excluding date)
    target_candidates = [(col, scores['target']) for col, scores in column_scores.items()
                         if scores['target'] > 0.3 and col != suggestions['date_col']]
    if target_candidates:
        target_candidates.sort(key=lambda x: x[1], reverse=True)
        suggestions['target_col'] = target_candidates[0][0]
        suggestions['confidence']['target_col'] = target_candidates[0][1]

    # Media columns (all with media score > 0.3, excluding date and target)
    excluded = {suggestions['date_col'], suggestions['target_col']}
    media_candidates = [(col, scores['media']) for col, scores in column_scores.items()
                        if scores['media'] > 0.3 and col not in excluded]
    media_candidates.sort(key=lambda x: x[1], reverse=True)
    suggestions['media_cols'] = [col for col, _ in media_candidates[:10]]  # Max 10 media columns
    if suggestions['media_cols']:
        suggestions['confidence']['media_cols'] = sum(s for _, s in media_candidates[:10]) / len(media_candidates[:10])

    # Control columns (all with control score > 0.3, excluding others)
    excluded.update(suggestions['media_cols'])
    control_candidates = [(col, scores['control']) for col, scores in column_scores.items()
                          if scores['control'] > 0.3 and col not in excluded]
    control_candidates.sort(key=lambda x: x[1], reverse=True)
    suggestions['control_cols'] = [col for col, _ in control_candidates[:10]]  # Max 10 control columns
    if suggestions['control_cols']:
        suggestions['confidence']['control_cols'] = sum(s for _, s in control_candidates[:10]) / len(control_candidates[:10])

    # Calculate overall confidence
    conf_values = [v for v in suggestions['confidence'].values() if isinstance(v, (int, float))]
    suggestions['overall_confidence'] = sum(conf_values) / len(conf_values) if conf_values else 0.0

    # Add alternative suggestions for columns with lower confidence
    suggestions['alternatives'] = {
        'date': [col for col, scores in column_scores.items()
                 if scores['date'] > 0.2 and col != suggestions['date_col']][:3],
        'target': [col for col, scores in column_scores.items()
                   if scores['target'] > 0.2 and col != suggestions['target_col'] and col not in excluded][:3],
    }

    return clean_for_json(suggestions)


@app.post("/api/data/quality-action")
async def apply_data_quality_action(action: DataQualityAction):
    """Apply a data quality action to the dataset."""
    if 'df' not in session_data:
        raise HTTPException(status_code=400, detail="No data loaded")

    df = session_data['df'].copy()

    if action.column not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column not found: {action.column}")

    col = action.column
    original_rows = len(df)
    modified_count = 0

    if action.action == "fill_mean":
        if pd.api.types.is_numeric_dtype(df[col]):
            missing_count = df[col].isna().sum()
            df[col] = df[col].fillna(df[col].mean())
            modified_count = missing_count
    elif action.action == "fill_median":
        if pd.api.types.is_numeric_dtype(df[col]):
            missing_count = df[col].isna().sum()
            df[col] = df[col].fillna(df[col].median())
            modified_count = missing_count
    elif action.action == "fill_zero":
        missing_count = df[col].isna().sum()
        df[col] = df[col].fillna(0)
        modified_count = missing_count
    elif action.action == "drop_rows":
        df = df.dropna(subset=[col])
        modified_count = original_rows - len(df)
    elif action.action == "cap_outliers":
        if pd.api.types.is_numeric_dtype(df[col]):
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower = Q1 - 1.5 * IQR
            upper = Q3 + 1.5 * IQR
            outliers = (df[col] < lower) | (df[col] > upper)
            modified_count = outliers.sum()
            df[col] = df[col].clip(lower=lower, upper=upper)
    elif action.action == "remove_duplicates":
        df = df.drop_duplicates()
        modified_count = original_rows - len(df)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action.action}")

    session_data['df'] = df

    return clean_for_json({
        "success": True,
        "action": action.action,
        "column": col,
        "modified_count": int(modified_count),
        "new_row_count": len(df),
    })


@app.post("/api/data/feature-engineering")
async def apply_feature_engineering(request: FeatureEngineeringRequest):
    """Create new features based on existing columns."""
    if 'df' not in session_data:
        raise HTTPException(status_code=400, detail="No data loaded")

    df = session_data['df'].copy()
    new_columns = []

    for col in request.columns:
        if col not in df.columns or not pd.api.types.is_numeric_dtype(df[col]):
            continue

        series = df[col].fillna(0)

        if request.operations.get('lags'):
            for lag in [1, 2, 4]:
                new_col = f"{col}_lag{lag}"
                df[new_col] = series.shift(lag)
                new_columns.append(new_col)

        if request.operations.get('rolling'):
            for window in [4, 8]:
                new_col = f"{col}_ma{window}"
                df[new_col] = series.rolling(window=window, min_periods=1).mean()
                new_columns.append(new_col)

        if request.operations.get('log'):
            new_col = f"{col}_log"
            df[new_col] = np.log1p(series.clip(lower=0))
            new_columns.append(new_col)

        if request.operations.get('yoy'):
            # Year-over-year change (assuming 52 weeks)
            new_col = f"{col}_yoy"
            df[new_col] = series.pct_change(periods=52) * 100
            new_columns.append(new_col)

    session_data['df'] = df

    return clean_for_json({
        "success": True,
        "new_columns": new_columns,
        "total_columns": len(df.columns),
    })


@app.get("/api/data/feature-preview")
async def preview_feature_engineering(columns: str, operations: str):
    """Preview feature engineering without applying."""
    if 'df' not in session_data:
        raise HTTPException(status_code=400, detail="No data loaded")

    df = session_data['df']
    cols = columns.split(',') if columns else []
    ops = {}
    for op in operations.split(','):
        if op:
            ops[op] = True

    preview = create_feature_engineering_preview(df, cols, ops)
    return clean_for_json(preview)


@app.post("/api/model/config")
async def set_model_config(config: ModelConfig):
    """Set the model configuration."""
    session_data['model_config'] = config.dict()
    return {"success": True, "config": config.dict()}


@app.post("/api/model/train")
async def train_model():
    """Train the MMM model with adstock, saturation, and control variables."""
    if 'df' not in session_data:
        raise HTTPException(status_code=400, detail="No data loaded")
    if 'mapping' not in session_data:
        raise HTTPException(status_code=400, detail="Column mapping not set")

    df = session_data['df'].copy()
    mapping = session_data['mapping']
    config = session_data.get('model_config') or ModelConfig().dict()

    try:
        # Preprocess data - aggregate by date
        date_col = mapping['date_col']
        target_col = mapping['target_col']
        media_cols = mapping['media_cols']
        control_cols = mapping.get('control_cols', [])

        # Convert date column
        df[date_col] = pd.to_datetime(df[date_col])

        # Aggregate by date (sum target and media spend, mean for controls)
        agg_cols = {target_col: 'sum'}
        for col in media_cols:
            agg_cols[col] = 'sum'
        for col in control_cols:
            if col in df.columns:
                agg_cols[col] = 'mean'

        df_agg = df.groupby(date_col).agg(agg_cols).reset_index()
        df_agg = df_agg.sort_values(date_col)

        # Drop rows with NaN in target or any media column
        df_agg = df_agg.dropna(subset=[target_col] + media_cols)

        # Ensure no zeros in target (for log transform)
        df_agg = df_agg[df_agg[target_col] > 0]

        # Note: Do NOT clip zeros - zero spend is meaningful data
        # The notebook shows that clipping corrupts the data and hurts model fit

        # Handle holdout validation
        holdout_weeks = config.get('holdout_weeks', 0)
        df_train = df_agg
        df_holdout = None
        if holdout_weeks > 0 and len(df_agg) > holdout_weeks + 10:
            df_train = df_agg.iloc[:-holdout_weeks].copy()
            df_holdout = df_agg.iloc[-holdout_weeks:].copy()

        # Store aggregated data
        session_data['df_agg'] = df_agg
        session_data['df_train'] = df_train
        session_data['df_holdout'] = df_holdout

        # Extract data from training set
        y = df_train[target_col].values
        X_media_raw = df_train[media_cols].values

        # ===== APPLY ADSTOCK TRANSFORMATION =====
        adstock_config = config.get('adstock_config') or {}
        X_media_adstocked = X_media_raw.copy()
        decay_rates_used = {}

        for i, col in enumerate(media_cols):
            col_config = adstock_config.get(col, {})
            if col_config.get('enabled', True):
                decay_rate = col_config.get('decay_rate', 0.3)
                decay_rates_used[col] = decay_rate
                X_media_adstocked[:, i] = geometric_adstock(
                    X_media_raw[:, i],
                    decay_rate=decay_rate,
                    normalize=True
                )
            else:
                decay_rates_used[col] = 0.0

        # ===== SCALE BY MEAN (Critical for numerical stability) =====
        # This matches the notebook's preprocessing approach
        X_media_means = {}
        for i, channel in enumerate(media_cols):
            mean_val = X_media_adstocked[:, i].mean()
            X_media_means[channel] = mean_val
            if mean_val > 0:
                X_media_adstocked[:, i] = X_media_adstocked[:, i] / mean_val
        print(f"Scaled X_media by mean: {X_media_means}")

        # ===== APPLY SATURATION (HILL FUNCTION) =====
        saturation_config = config.get('saturation_config') or {}
        X_media_saturated = X_media_adstocked.copy()
        saturation_params_used = {}

        for i, col in enumerate(media_cols):
            col_config = saturation_config.get(col, {})
            if col_config.get('enabled', False):  # Disabled by default to maintain backwards compatibility
                K_raw = col_config.get('K', 50000)  # K in raw spend units
                S = col_config.get('S', 1.5)
                # Scale K by the same factor used to scale the data
                # K_raw is in original units, data is now scaled by mean
                mean_val = X_media_means.get(col, 1.0)
                K_scaled = K_raw / mean_val if mean_val > 0 else K_raw
                saturation_params_used[col] = {'K': K_raw, 'S': S}  # Store original K for display
                print(f"Saturation for {col}: K_raw={K_raw}, mean={mean_val:.2f}, K_scaled={K_scaled:.4f}, S={S}")
                # Scale the saturated values back to original scale for interpretability
                max_val = X_media_adstocked[:, i].max()
                X_media_saturated[:, i] = hill_function_scaled(
                    X_media_adstocked[:, i],
                    K=K_scaled, S=S,
                    max_effect=max_val
                )
            else:
                saturation_params_used[col] = {'K': 0, 'S': 0, 'enabled': False}

        X_media = X_media_saturated

        # ===== PREPARE CONTROL VARIABLES =====
        X_controls = None
        valid_control_cols = []
        if config.get('use_controls', True) and control_cols:
            valid_control_cols = [c for c in control_cols if c in df_train.columns]
            if valid_control_cols:
                X_controls = df_train[valid_control_cols].fillna(0).values
                # Standardize controls
                X_controls = (X_controls - X_controls.mean(axis=0)) / (X_controls.std(axis=0) + 1e-8)

        # ===== CREATE CUSTOM EVENT INDICATORS =====
        custom_events = config.get('custom_events', [])
        X_events = None
        event_names = []
        if custom_events:
            dates = pd.to_datetime(df_train[date_col])
            event_matrix = []
            for event in custom_events:
                start = pd.to_datetime(event['start_date'])
                end = pd.to_datetime(event['end_date'])
                indicator = ((dates >= start) & (dates <= end)).astype(float).values
                event_matrix.append(indicator)
                event_names.append(event['name'])
            if event_matrix:
                X_events = np.column_stack(event_matrix)

        # ===== CREATE TREND FEATURE =====
        trend_type = config.get('trend_type', 'linear')
        n_periods = len(df_train)
        t = np.arange(n_periods)

        if trend_type == 'none':
            trend = np.zeros(n_periods)
        elif trend_type == 'linear':
            trend = t / n_periods
        elif trend_type == 'log':
            trend = np.log1p(t) / np.log1p(n_periods)
        elif trend_type == 'quadratic':
            trend = (t / n_periods) ** 2
        else:
            trend = t / n_periods

        # Scale trend to [0, 1] range (matches notebook preprocessing)
        if trend is not None and trend.max() > 0:
            trend = trend / trend.max()
            print(f"Scaled trend to [0, 1], range: {trend.min():.4f} to {trend.max():.4f}")

        # ===== CREATE FOURIER FEATURES =====
        if config.get('seasonality_enabled', True):
            X_fourier = create_fourier_features(
                n_periods,
                period=config['seasonality_period'],
                harmonics=config['fourier_harmonics'],
            )
        else:
            X_fourier = np.zeros((n_periods, 1))  # Dummy

        # ===== BUILD PRIOR CONFIG =====
        prior_config_dict = config.get('prior_config') or {}
        model_prior_config = {}
        for col in media_cols:
            col_prior = prior_config_dict.get(col, {})
            if col_prior:
                model_prior_config[f'beta_{col}_sigma'] = col_prior.get('sigma', 0.3)

        # ===== BUILD AND FIT MODEL =====
        if config['model_type'] == 'loglog':
            model = build_loglog_model(
                X_media=X_media,
                X_fourier=X_fourier,
                trend=trend,
                y=y,
                channel_names=media_cols,
                X_events=X_events if X_events is not None and X_events.shape[1] > 0 else None,
                event_names=event_names if event_names else None,
                X_controls=X_controls if X_controls is not None and X_controls.shape[1] > 0 else None,
                control_names=valid_control_cols if valid_control_cols else None,
                prior_config=model_prior_config if model_prior_config else None,
            )
            # Debug output
            if X_events is not None and X_events.shape[1] > 0:
                print(f"Events passed to model: {event_names}")
                print(f"Events contribution range: {X_events.min():.4f} to {X_events.max():.4f}")
            if X_controls is not None and X_controls.shape[1] > 0:
                print(f"Controls passed to model: {valid_control_cols}")
        else:
            model = build_lift_model(
                X_media=X_media,
                X_fourier=X_fourier,
                trend=trend,
                y=y,
                channel_names=media_cols,
                prior_config=model_prior_config if model_prior_config else None,
            )

        # Fit model
        trace = fit_model(
            model,
            draws=config['mcmc_draws'],
            tune=config['mcmc_tune'],
            chains=config['mcmc_chains'],
        )

        # Store results
        session_data['model'] = model
        session_data['trace'] = trace
        session_data['y'] = y
        session_data['X_media'] = X_media
        session_data['X_media_raw'] = X_media_raw
        session_data['X_media_adstocked'] = X_media_adstocked
        session_data['media_cols'] = media_cols
        session_data['control_cols'] = valid_control_cols
        session_data['X_controls'] = X_controls
        session_data['X_events'] = X_events
        session_data['event_names'] = event_names
        session_data['X_fourier'] = X_fourier
        session_data['trend'] = trend
        session_data['decay_rates'] = decay_rates_used
        session_data['saturation_params'] = saturation_params_used
        session_data['X_media_means'] = X_media_means  # Scaling factors used

        # Compute diagnostics
        diagnostics = compute_model_diagnostics(trace)

        # Calculate holdout metrics if applicable
        holdout_metrics = None
        if df_holdout is not None and len(df_holdout) > 0:
            n_train = len(y)  # Number of training periods
            holdout_metrics = compute_holdout_metrics(
                df_holdout, media_cols, target_col, trace,
                decay_rates_used, saturation_params_used, config,
                n_train=n_train,
                control_cols=valid_control_cols,
                event_names=event_names,
                X_media_means=X_media_means
            )
            session_data['holdout_metrics'] = holdout_metrics

        return clean_for_json({
            "success": True,
            "diagnostics": diagnostics,
            "converged": diagnostics['converged'],
            "holdout_metrics": holdout_metrics,
            "transformations_applied": {
                "adstock": decay_rates_used,
                "saturation": {k: v for k, v in saturation_params_used.items() if v is not None},
                "controls_used": valid_control_cols,
                "events_used": event_names,
            }
        })

    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"{str(e)}\n{traceback.format_exc()}")


@app.get("/api/model/results")
async def get_model_results():
    """Get comprehensive model results including diagnostics, residuals, and Shapley values."""
    if 'trace' not in session_data:
        raise HTTPException(status_code=400, detail="Model not trained")

    trace = session_data['trace']
    mapping = session_data['mapping']
    y = session_data['y']
    X_media = session_data['X_media']
    X_media_raw = session_data.get('X_media_raw', X_media)
    media_cols = mapping['media_cols']

    # Get posterior samples
    posterior = {
        var: trace.posterior[var].values
        for var in trace.posterior.data_vars
    }

    # Compute contributions
    X_media_log = log_transform(X_media)
    contributions = compute_channel_contributions_loglog(
        trace_posterior=posterior,
        X_media_log=X_media_log,
        y_mean=y.mean(),
        channel_names=media_cols,
        X_media_raw=X_media_raw,
    )

    # Compute ROI
    channel_spend = {
        col: float(X_media_raw[:, i].sum())
        for i, col in enumerate(media_cols)
    }
    channel_contrib = {
        col: contributions[col]['contribution_mean']
        for col in media_cols
    }
    roi_df = calculate_roi(channel_contrib, channel_spend)

    # Compute predictions (include all model components)
    y_log = np.log(y + 1)
    beta_mean = posterior['beta'].mean(axis=(0, 1))
    intercept_mean = float(posterior['intercept'].mean())

    # Get seasonality and trend coefficients
    X_fourier = session_data.get('X_fourier')
    trend = session_data.get('trend')
    gamma_fourier_mean = posterior['gamma_fourier'].mean(axis=(0, 1)) if 'gamma_fourier' in posterior else np.zeros(X_fourier.shape[1] if X_fourier is not None else 1)
    gamma_trend_mean = float(posterior['gamma_trend'].mean()) if 'gamma_trend' in posterior else 0.0

    # Full prediction: intercept + media + seasonality + trend + events + controls
    y_pred_log = intercept_mean + np.dot(X_media_log, beta_mean)
    if X_fourier is not None and len(gamma_fourier_mean) == X_fourier.shape[1]:
        y_pred_log = y_pred_log + np.dot(X_fourier, gamma_fourier_mean)
    if trend is not None:
        y_pred_log = y_pred_log + gamma_trend_mean * trend

    # Add events contribution (e.g., COVID impact)
    X_events = session_data.get('X_events')
    event_names = session_data.get('event_names', [])
    if X_events is not None and X_events.shape[1] > 0 and 'gamma_events' in posterior:
        gamma_events_mean = posterior['gamma_events'].mean(axis=(0, 1))
        events_contribution = np.dot(X_events, gamma_events_mean)
        y_pred_log = y_pred_log + events_contribution
        print(f"Events contribution range: {events_contribution.min():.4f} to {events_contribution.max():.4f}")

    # Add controls contribution (already standardized, no log transform)
    X_controls = session_data.get('X_controls')
    control_cols = session_data.get('control_cols', [])
    if X_controls is not None and X_controls.shape[1] > 0 and 'gamma_controls' in posterior:
        gamma_controls_mean = posterior['gamma_controls'].mean(axis=(0, 1))
        controls_contribution = np.dot(X_controls, gamma_controls_mean)
        y_pred_log = y_pred_log + controls_contribution
        print(f"Controls contribution range: {controls_contribution.min():.4f} to {controls_contribution.max():.4f}")

    y_pred = np.exp(y_pred_log) - 1

    # Compute R-squared
    ss_res = np.sum((y_log - y_pred_log) ** 2)
    ss_tot = np.sum((y_log - y_log.mean()) ** 2)
    r_squared = 1 - (ss_res / ss_tot)

    # Debug output
    print(f"=== R-SQUARED DEBUG ===")
    print(f"y range: {y.min():.2f} to {y.max():.2f}, mean: {y.mean():.2f}")
    print(f"y_log range: {y_log.min():.4f} to {y_log.max():.4f}")
    print(f"y_pred_log range: {y_pred_log.min():.4f} to {y_pred_log.max():.4f}")
    print(f"Intercept: {intercept_mean:.4f}")
    print(f"Beta means: {beta_mean}")
    print(f"Gamma trend mean: {gamma_trend_mean:.6f}")
    if X_fourier is not None:
        print(f"Gamma fourier means: {gamma_fourier_mean}")
        print(f"X_fourier shape: {X_fourier.shape}")
        print(f"Fourier contribution range: {np.dot(X_fourier, gamma_fourier_mean).min():.4f} to {np.dot(X_fourier, gamma_fourier_mean).max():.4f}")
    if trend is not None:
        print(f"Trend contribution range: {(gamma_trend_mean * trend).min():.4f} to {(gamma_trend_mean * trend).max():.4f}")
    print(f"SS_res: {ss_res:.4f}, SS_tot: {ss_tot:.4f}")
    print(f"R-squared: {r_squared:.4f}")
    print(f"=== END DEBUG ===")

    # MAPE
    mape = np.mean(np.abs((y - y_pred) / y)) * 100

    # ===== RESIDUAL ANALYSIS =====
    residual_analysis = compute_residual_analysis(y, y_pred)

    # ===== POSTERIOR PREDICTIVE CHECK =====
    posterior_predictive = {
        'actual': y.tolist(),
        'predicted': y_pred.tolist(),
        'predicted_ci_lower': [],
        'predicted_ci_upper': [],
    }
    # Compute prediction intervals (include all components)
    all_betas = posterior['beta'].reshape(-1, len(media_cols))
    all_intercepts = posterior['intercept'].flatten()
    all_gamma_fourier = posterior['gamma_fourier'].reshape(-1, posterior['gamma_fourier'].shape[-1]) if 'gamma_fourier' in posterior else None
    all_gamma_trend = posterior['gamma_trend'].flatten() if 'gamma_trend' in posterior else None
    all_gamma_events = posterior['gamma_events'].reshape(-1, posterior['gamma_events'].shape[-1]) if 'gamma_events' in posterior else None
    all_gamma_controls = posterior['gamma_controls'].reshape(-1, posterior['gamma_controls'].shape[-1]) if 'gamma_controls' in posterior else None

    n_samples = min(500, len(all_intercepts))
    sample_indices = np.random.choice(len(all_intercepts), n_samples, replace=False)

    pred_samples = []
    for idx in sample_indices:
        y_sample = all_intercepts[idx] + np.dot(X_media_log, all_betas[idx])
        if all_gamma_fourier is not None and X_fourier is not None:
            y_sample = y_sample + np.dot(X_fourier, all_gamma_fourier[idx])
        if all_gamma_trend is not None and trend is not None:
            y_sample = y_sample + all_gamma_trend[idx] * trend
        if all_gamma_events is not None and X_events is not None and X_events.shape[1] > 0:
            y_sample = y_sample + np.dot(X_events, all_gamma_events[idx])
        if all_gamma_controls is not None and X_controls is not None and X_controls.shape[1] > 0:
            y_sample = y_sample + np.dot(X_controls, all_gamma_controls[idx])
        pred_samples.append(np.exp(y_sample) - 1)
    pred_samples = np.array(pred_samples)

    posterior_predictive['predicted_ci_lower'] = np.percentile(pred_samples, 5, axis=0).tolist()
    posterior_predictive['predicted_ci_upper'] = np.percentile(pred_samples, 95, axis=0).tolist()

    # ===== RESPONSE CURVES =====
    # Compute actual dollar contributions for each channel (not log-space approximation)
    # Baseline = what sales would be with zero media spend
    baseline_log = intercept_mean
    if trend is not None:
        baseline_log = baseline_log + gamma_trend_mean * trend
    if X_fourier is not None and 'gamma_fourier' in posterior:
        baseline_log = baseline_log + np.dot(X_fourier, gamma_fourier_mean)
    if X_events is not None and X_events.shape[1] > 0 and 'gamma_events' in posterior:
        gamma_events_mean = posterior['gamma_events'].mean(axis=(0, 1))
        baseline_log = baseline_log + np.dot(X_events, gamma_events_mean)
    if X_controls is not None and X_controls.shape[1] > 0 and 'gamma_controls' in posterior:
        gamma_controls_mean = posterior['gamma_controls'].mean(axis=(0, 1))
        baseline_log = baseline_log + np.dot(X_controls, gamma_controls_mean)

    baseline_sales = np.exp(baseline_log) - 1
    total_media_effect = y_pred - baseline_sales  # Per-period media effect in dollars

    # Compute each channel's share of total media effect
    media_log_contribs = np.zeros((len(y), len(media_cols)))
    for j, col in enumerate(media_cols):
        media_log_contribs[:, j] = beta_mean[j] * X_media_log[:, j]
    total_media_log = media_log_contribs.sum(axis=1)

    # Actual dollar contributions per channel (summed across all periods)
    actual_channel_contrib = {}
    for j, col in enumerate(media_cols):
        # For each period, channel's share of media effect
        channel_shares = np.where(total_media_log > 0,
                                  media_log_contribs[:, j] / total_media_log,
                                  0)
        channel_dollar_contrib = channel_shares * np.maximum(0, total_media_effect)
        actual_channel_contrib[col] = float(channel_dollar_contrib.sum())

    elasticities = {col: contributions[col]['elasticity_mean'] for col in media_cols}
    saturation_params = session_data.get('saturation_params', {})
    response_curves = compute_response_curves(
        media_cols, elasticities, channel_spend, saturation_params,
        current_contributions=actual_channel_contrib
    )

    # Recalculate ROI with actual dollar contributions
    roi_df = calculate_roi(actual_channel_contrib, channel_spend)

    # ===== SHAPLEY VALUES =====
    baseline = np.exp(intercept_mean)
    channel_effects = {col: actual_channel_contrib[col] for col in media_cols}
    shapley_values = compute_shapley_values(baseline, channel_effects)

    # Prepare Shapley attribution table
    total_attributed = sum(shapley_values.values())
    shapley_attribution = []
    for col in media_cols:
        shapley_attribution.append({
            'channel': col,
            'shapley_value': shapley_values.get(col, 0),
            'share': shapley_values.get(col, 0) / total_attributed * 100 if total_attributed > 0 else 0,
            'direct_contribution': actual_channel_contrib.get(col, 0),
        })

    # Compute decomposition time series
    df_agg = session_data.get('df_agg')
    df_train = session_data.get('df_train', df_agg)
    decomposition = []
    if df_train is not None:
        date_col = mapping['date_col']
        dates = pd.to_datetime(df_train[date_col]).dt.strftime('%Y-%m-%d').tolist()

        # Get trend and seasonality for baseline calculation (use same variables as y_pred calculation)
        # X_fourier and trend are already fetched above (lines ~1548-1551)
        # gamma_fourier_mean and gamma_trend_mean are already computed above

        for i, date in enumerate(dates):
            if i >= len(y):
                break
            row = {"date": date, "actual": float(y[i]), "predicted": float(y_pred[i])}

            # Baseline = intercept + trend + seasonality (everything except media)
            # This represents what sales would be with zero media spend
            baseline_log = intercept_mean

            # Add trend contribution
            if trend is not None:
                baseline_log += gamma_trend_mean * trend[i]

            # Add seasonality contribution (use X_fourier, not fourier_features)
            if X_fourier is not None and 'gamma_fourier' in posterior:
                baseline_log += np.dot(X_fourier[i], gamma_fourier_mean)

            # Convert to original scale (same transform as y_pred)
            baseline_val = np.exp(baseline_log) - 1
            row["baseline"] = float(max(0, baseline_val))

            # Channel contributions: proportional share of total media effect
            # Total media effect = y_pred - baseline
            total_media_effect = y_pred[i] - baseline_val

            # Compute each channel's share based on their log-space contribution
            media_log_contribs = []
            for j, col in enumerate(media_cols):
                media_log_contribs.append(beta_mean[j] * X_media_log[i, j])

            total_media_log = sum(media_log_contribs)

            for j, col in enumerate(media_cols):
                if total_media_log > 0 and total_media_effect > 0:
                    # Proportional attribution based on log-space contribution
                    share = media_log_contribs[j] / total_media_log
                    row[col] = float(max(0, share * total_media_effect))
                else:
                    row[col] = 0.0

            decomposition.append(row)

    # ===== HOLDOUT METRICS =====
    holdout_metrics = session_data.get('holdout_metrics')

    # ===== MODEL DIAGNOSTICS =====
    diagnostics = compute_model_diagnostics(trace)

    # Build event coefficients if available
    event_coefficients = None
    if 'gamma_events' in posterior and event_names:
        gamma_events_samples = posterior['gamma_events']
        event_coefficients = {
            name: {
                "mean": float(gamma_events_samples[:, :, i].mean()),
                "ci_lower": float(np.percentile(gamma_events_samples[:, :, i], 2.5)),
                "ci_upper": float(np.percentile(gamma_events_samples[:, :, i], 97.5)),
            }
            for i, name in enumerate(event_names)
        }

    # Build control coefficients if available
    control_coefficients = None
    if 'gamma_controls' in posterior and control_cols:
        gamma_controls_samples = posterior['gamma_controls']
        control_coefficients = {
            name: {
                "mean": float(gamma_controls_samples[:, :, i].mean()),
                "ci_lower": float(np.percentile(gamma_controls_samples[:, :, i], 2.5)),
                "ci_upper": float(np.percentile(gamma_controls_samples[:, :, i], 97.5)),
            }
            for i, name in enumerate(control_cols)
        }

    return clean_for_json({
        "r_squared": float(r_squared),
        "mape": float(mape),
        "contributions": contributions,
        "roi": roi_df.to_dict(orient='records'),
        "elasticities": {
            col: {
                "mean": contributions[col]['elasticity_mean'],
                "ci_lower": contributions[col]['elasticity_ci_lower'],
                "ci_upper": contributions[col]['elasticity_ci_upper'],
            }
            for col in media_cols
        },
        "decomposition": decomposition,
        "residual_analysis": residual_analysis,
        "posterior_predictive": posterior_predictive,
        "response_curves": response_curves,
        "shapley_attribution": shapley_attribution,
        "holdout_metrics": holdout_metrics,
        "diagnostics": diagnostics,
        "event_coefficients": event_coefficients,
        "control_coefficients": control_coefficients,
        "transformations": {
            "adstock": session_data.get('decay_rates', {}),
            "saturation": session_data.get('saturation_params', {}),
            "events": event_names if event_names else [],
            "controls": control_cols if control_cols else [],
        }
    })


@app.post("/api/optimize")
async def optimize_budget(request: OptimizationRequest):
    """Optimize budget allocation."""
    if 'trace' not in session_data:
        raise HTTPException(status_code=400, detail="Model not trained")

    mapping = session_data['mapping']
    y = session_data['y']
    X_media = session_data['X_media']
    X_media_raw = session_data.get('X_media_raw', X_media)
    media_cols = mapping['media_cols']

    # Get elasticities from trace
    trace = session_data['trace']
    posterior = trace.posterior
    betas = posterior['beta'].values
    beta_mean = betas.mean(axis=(0, 1))
    elasticities = {
        col: float(beta_mean[i])
        for i, col in enumerate(media_cols)
    }

    # Current spend (use raw spend values summed over all periods)
    current_spend = {
        col: float(X_media_raw[:, i].sum())
        for i, col in enumerate(media_cols)
    }

    # Compute channel contributions using log-log model
    # This matches the approach in get_model_results
    X_media_log = log_transform(X_media)
    intercept_mean = float(posterior['intercept'].values.mean())

    # Compute per-channel contributions (in sales units)
    channel_contributions = {}
    for i, col in enumerate(media_cols):
        # Average contribution per period from this channel
        # In log-log: contribution in log-space = beta * log(X)
        # Approximate sales contribution = total_sales * (channel_effect / total_effect)
        channel_effect = beta_mean[i] * X_media_log[:, i].mean()
        total_media_effect = sum(beta_mean[j] * X_media_log[:, j].mean() for j in range(len(media_cols)))
        if total_media_effect > 0:
            # Proportion of sales attributable to this channel
            channel_share = channel_effect / total_media_effect
            channel_contributions[col] = float(y.sum() * channel_share)
        else:
            channel_contributions[col] = 0.0

    # Optimize
    optimal_spend = optimize_budget_marginal_roi(
        total_budget=request.total_budget,
        channels=media_cols,
        elasticities=elasticities,
        current_spend=current_spend,
        avg_sales=float(y.mean()),
        constraints=request.constraints,
    )

    # Calculate expected lift with channel contributions
    lift = calculate_expected_lift(
        current_spend=current_spend,
        optimal_spend=optimal_spend,
        elasticities=elasticities,
        current_sales=float(y.sum()),
        channel_contributions=channel_contributions,
    )

    return {
        "current_spend": current_spend,
        "optimal_spend": optimal_spend,
        "expected_lift": lift,
        "changes": {
            col: {
                "current": current_spend[col],
                "optimal": optimal_spend[col],
                "change_pct": (optimal_spend[col] - current_spend[col]) / current_spend[col] * 100
                if current_spend[col] > 0 else 0
            }
            for col in media_cols
        },
    }


@app.post("/api/scenarios/create")
async def create_new_scenario(request: ScenarioRequest):
    """Create a new scenario."""
    if 'trace' not in session_data:
        raise HTTPException(status_code=400, detail="Model not trained")

    mapping = session_data['mapping']
    y = session_data['y']
    X_media = session_data['X_media']
    X_media_raw = session_data.get('X_media_raw', X_media)
    media_cols = mapping['media_cols']

    trace = session_data['trace']
    posterior = trace.posterior
    betas = posterior['beta'].values
    beta_mean = betas.mean(axis=(0, 1))
    elasticities = {
        col: float(beta_mean[i])
        for i, col in enumerate(media_cols)
    }

    # Get baseline spend (average spend per channel from training data)
    baseline_spend = {
        col: float(X_media_raw[:, i].mean())
        for i, col in enumerate(media_cols)
    }

    scenario = create_scenario(
        name=request.name,
        spend_allocation=request.spend_allocation,
        elasticities=elasticities,
        baseline_sales=float(y.mean()),
        baseline_spend=baseline_spend,
    )

    # Store scenario
    if 'scenarios' not in session_data:
        session_data['scenarios'] = []
    session_data['scenarios'].append(scenario)

    return scenario


@app.get("/api/scenarios")
async def get_scenarios():
    """Get all saved scenarios."""
    scenarios = session_data.get('scenarios', [])
    if scenarios:
        comparison = compare_scenarios(scenarios)
        return {
            "scenarios": scenarios,
            "comparison": comparison.to_dict(orient='records'),
        }
    return {"scenarios": [], "comparison": []}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
