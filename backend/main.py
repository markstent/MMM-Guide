"""FastAPI backend for MMM Dashboard."""

import sys
from pathlib import Path

# Add dashboard/core to path so we can import the existing modules
sys.path.insert(0, str(Path(__file__).parent.parent / "dashboard"))

from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import pandas as pd
import numpy as np
import io
import json


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
from core import (
    geometric_adstock_matrix,
    log_transform,
    build_loglog_model,
    build_lift_model,
    fit_model,
    compute_model_diagnostics,
    compute_channel_contributions_loglog,
    calculate_roi,
    optimize_budget_marginal_roi,
    calculate_expected_lift,
    create_scenario,
    compare_scenarios,
)

app = FastAPI(
    title="MMM Studio API",
    description="Marketing Mix Modeling Backend API",
    version="1.0.0",
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for session data (would use Redis/DB in production)
session_data: Dict[str, Any] = {}


# Pydantic models for request/response
class ColumnMapping(BaseModel):
    date_col: str
    target_col: str
    media_cols: List[str]
    control_cols: Optional[List[str]] = []


class ModelConfig(BaseModel):
    model_type: str = "loglog"  # "loglog" or "lift"
    seasonality_period: int = 52
    fourier_harmonics: int = 3
    mcmc_draws: int = 2000
    mcmc_tune: int = 1000
    mcmc_chains: int = 4


class OptimizationRequest(BaseModel):
    total_budget: float
    constraints: Optional[Dict[str, tuple]] = None


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
    return {"status": "ok", "message": "MMM Studio API"}


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
        "conjura": Path(__file__).parent.parent / "conjura_mmm_data.csv",
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
    """Get data exploration statistics."""
    if 'df' not in session_data:
        raise HTTPException(status_code=400, detail="No data loaded")

    df = session_data['df']
    mapping = session_data.get('mapping', {})

    # Basic stats
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    # Get date range
    date_col = mapping.get('date_col')
    date_range = None
    if date_col and date_col in df.columns:
        try:
            dates = pd.to_datetime(df[date_col])
            date_range = {
                "start": dates.min().strftime('%Y-%m-%d'),
                "end": dates.max().strftime('%Y-%m-%d'),
            }
        except Exception:
            pass

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

    # Column stats
    column_stats = {}
    for col in df.columns:
        stats = {
            "dtype": str(df[col].dtype),
            "non_null": int(df[col].notna().sum()),
            "null_count": int(df[col].isna().sum()),
        }
        if pd.api.types.is_numeric_dtype(df[col]):
            stats["mean"] = float(df[col].mean()) if not df[col].isna().all() else None
            stats["std"] = float(df[col].std()) if not df[col].isna().all() else None
            stats["min"] = float(df[col].min()) if not df[col].isna().all() else None
            stats["max"] = float(df[col].max()) if not df[col].isna().all() else None
        column_stats[col] = stats

    # Correlation matrix for numeric columns
    correlations = {}
    if len(numeric_cols) > 1:
        corr_df = df[numeric_cols].corr()
        for col in numeric_cols:
            correlations[col] = {c: corr_df.loc[col, c] for c in numeric_cols}

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

    return clean_for_json({
        "summary": summary,
        "column_stats": column_stats,
        "correlations": correlations,
        "time_series": time_series,
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


@app.post("/api/model/config")
async def set_model_config(config: ModelConfig):
    """Set the model configuration."""
    session_data['model_config'] = config.dict()
    return {"success": True, "config": config.dict()}


@app.post("/api/model/train")
async def train_model():
    """Train the MMM model."""
    if 'df' not in session_data:
        raise HTTPException(status_code=400, detail="No data loaded")
    if 'mapping' not in session_data:
        raise HTTPException(status_code=400, detail="Column mapping not set")

    df = session_data['df'].copy()
    mapping = session_data['mapping']
    config = session_data.get('model_config', ModelConfig().dict())

    try:
        # Preprocess data - aggregate by date
        date_col = mapping['date_col']
        target_col = mapping['target_col']
        media_cols = mapping['media_cols']

        # Convert date column
        df[date_col] = pd.to_datetime(df[date_col])

        # Aggregate by date (sum target and media spend)
        agg_cols = {target_col: 'sum'}
        for col in media_cols:
            agg_cols[col] = 'sum'

        df_agg = df.groupby(date_col).agg(agg_cols).reset_index()
        df_agg = df_agg.sort_values(date_col)

        # Drop rows with NaN in target or any media column
        df_agg = df_agg.dropna(subset=[target_col] + media_cols)

        # Ensure no zeros in target (for log transform)
        df_agg = df_agg[df_agg[target_col] > 0]

        # Also ensure no zeros in media (add small constant)
        for col in media_cols:
            df_agg[col] = df_agg[col].clip(lower=1)

        # Store aggregated data
        session_data['df_agg'] = df_agg

        # Extract data
        y = df_agg[target_col].values
        X_media = df_agg[media_cols].values

        # Create trend
        trend = np.arange(len(df_agg)) / len(df_agg)

        # Create Fourier features
        X_fourier = create_fourier_features(
            len(df_agg),
            period=config['seasonality_period'],
            harmonics=config['fourier_harmonics'],
        )

        # Build and fit model
        if config['model_type'] == 'loglog':
            model = build_loglog_model(
                X_media=X_media,
                X_fourier=X_fourier,
                trend=trend,
                y=y,
                channel_names=media_cols,
            )
        else:
            model = build_lift_model(
                X_media=X_media,
                X_fourier=X_fourier,
                trend=trend,
                y=y,
                channel_names=media_cols,
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
        session_data['media_cols'] = media_cols

        # Compute diagnostics
        diagnostics = compute_model_diagnostics(trace)

        return clean_for_json({
            "success": True,
            "diagnostics": diagnostics,
            "converged": diagnostics['converged'],
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/model/results")
async def get_model_results():
    """Get model results and channel contributions."""
    if 'trace' not in session_data:
        raise HTTPException(status_code=400, detail="Model not trained")

    trace = session_data['trace']
    mapping = session_data['mapping']
    y = session_data['y']
    X_media = session_data['X_media']

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
        channel_names=mapping['media_cols'],
    )

    # Compute ROI
    channel_spend = {
        col: X_media[:, i].sum()
        for i, col in enumerate(mapping['media_cols'])
    }
    channel_contrib = {
        col: contributions[col]['contribution_mean']
        for col in mapping['media_cols']
    }
    roi_df = calculate_roi(channel_contrib, channel_spend)

    # Compute R-squared
    y_log = np.log(y + 1)
    y_pred_log = posterior['intercept'].mean() + np.dot(X_media_log, posterior['beta'].mean(axis=(0, 1)))
    ss_res = np.sum((y_log - y_pred_log) ** 2)
    ss_tot = np.sum((y_log - y_log.mean()) ** 2)
    r_squared = 1 - (ss_res / ss_tot)

    # MAPE
    y_pred = np.exp(y_pred_log) - 1
    mape = np.mean(np.abs((y - y_pred) / y)) * 100

    # Compute decomposition time series
    df_agg = session_data.get('df_agg')
    decomposition = []
    if df_agg is not None:
        date_col = mapping['date_col']
        dates = pd.to_datetime(df_agg[date_col]).dt.strftime('%Y-%m-%d').tolist()

        # Calculate baseline and channel contributions per period
        beta_mean = posterior['beta'].mean(axis=(0, 1))
        intercept_mean = posterior['intercept'].mean()

        for i, date in enumerate(dates):
            row = {"date": date, "actual": float(y[i])}

            # Baseline (intercept contribution)
            baseline = np.exp(intercept_mean)
            row["baseline"] = float(baseline)

            # Channel contributions
            total_media = 0
            for j, col in enumerate(mapping['media_cols']):
                contrib = np.exp(beta_mean[j] * X_media_log[i, j]) - 1
                contrib_scaled = baseline * contrib
                row[col] = float(max(0, contrib_scaled))
                total_media += row[col]

            decomposition.append(row)

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
            for col in mapping['media_cols']
        },
        "decomposition": decomposition,
    })


@app.post("/api/optimize")
async def optimize_budget(request: OptimizationRequest):
    """Optimize budget allocation."""
    if 'trace' not in session_data:
        raise HTTPException(status_code=400, detail="Model not trained")

    mapping = session_data['mapping']
    y = session_data['y']
    X_media = session_data['X_media']

    # Get elasticities from trace
    trace = session_data['trace']
    betas = trace.posterior['beta'].values
    elasticities = {
        col: float(betas[:, :, i].mean())
        for i, col in enumerate(mapping['media_cols'])
    }

    # Current spend
    current_spend = {
        col: float(X_media[:, i].sum())
        for i, col in enumerate(mapping['media_cols'])
    }

    # Optimize
    optimal_spend = optimize_budget_marginal_roi(
        total_budget=request.total_budget,
        channels=mapping['media_cols'],
        elasticities=elasticities,
        current_spend=current_spend,
        avg_sales=float(y.mean()),
        constraints=request.constraints,
    )

    # Calculate expected lift
    lift = calculate_expected_lift(
        current_spend=current_spend,
        optimal_spend=optimal_spend,
        elasticities=elasticities,
        current_sales=float(y.sum()),
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
            for col in mapping['media_cols']
        },
    }


@app.post("/api/scenarios/create")
async def create_new_scenario(request: ScenarioRequest):
    """Create a new scenario."""
    if 'trace' not in session_data:
        raise HTTPException(status_code=400, detail="Model not trained")

    mapping = session_data['mapping']
    y = session_data['y']

    trace = session_data['trace']
    betas = trace.posterior['beta'].values
    elasticities = {
        col: float(betas[:, :, i].mean())
        for i, col in enumerate(mapping['media_cols'])
    }

    scenario = create_scenario(
        name=request.name,
        spend_allocation=request.spend_allocation,
        elasticities=elasticities,
        baseline_sales=float(y.mean()),
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
