"""Data preprocessing utilities for MMM."""

import pandas as pd
import numpy as np
from typing import List, Optional, Tuple


def prepare_data_for_modeling(
    df: pd.DataFrame,
    date_col: str,
    target_col: str,
    media_cols: List[str],
    control_cols: Optional[List[str]] = None,
    aggregation: str = "Weekly",
    segment_col: Optional[str] = None,
    segment_value: Optional[str] = None,
) -> Tuple[pd.DataFrame, dict]:
    """
    Prepare data for MMM modeling.

    Args:
        df: Raw DataFrame
        date_col: Name of date column
        target_col: Name of target/KPI column
        media_cols: List of media spend column names
        control_cols: Optional list of control variable columns
        aggregation: Aggregation level ('Daily', 'Weekly', 'Monthly')
        segment_col: Optional column for filtering by segment
        segment_value: Value to filter segment by

    Returns:
        Tuple of (prepared_df, metadata_dict)
    """
    control_cols = control_cols or []

    # Make a copy to avoid modifying original
    data = df.copy()

    # Filter by segment if specified
    if segment_col and segment_value:
        data = data[data[segment_col] == segment_value].copy()

    # Parse dates
    data[date_col] = pd.to_datetime(data[date_col])
    data = data.sort_values(date_col).reset_index(drop=True)

    # Select columns
    all_cols = [date_col, target_col] + media_cols + control_cols
    data = data[all_cols].copy()

    # Handle missing values
    data = data.dropna()

    # Aggregate if needed
    if aggregation == "Weekly":
        data['period'] = data[date_col].dt.to_period('W').dt.start_time
        numeric_cols = [target_col] + media_cols + control_cols
        data = data.groupby('period')[numeric_cols].sum().reset_index()
        data = data.rename(columns={'period': date_col})
    elif aggregation == "Monthly":
        data['period'] = data[date_col].dt.to_period('M').dt.start_time
        numeric_cols = [target_col] + media_cols + control_cols
        data = data.groupby('period')[numeric_cols].sum().reset_index()
        data = data.rename(columns={'period': date_col})

    # Add time index
    data['time_index'] = np.arange(len(data))

    # Calculate metadata
    metadata = {
        'n_observations': len(data),
        'n_media_channels': len(media_cols),
        'date_range': (data[date_col].min(), data[date_col].max()),
        'aggregation': aggregation,
        'media_columns': media_cols,
        'control_columns': control_cols,
        'target_column': target_col,
        'date_column': date_col,
    }

    # Calculate summary statistics for scaling
    metadata['target_mean'] = data[target_col].mean()
    metadata['target_std'] = data[target_col].std()
    metadata['media_means'] = {col: data[col].mean() for col in media_cols}
    metadata['media_stds'] = {col: data[col].std() for col in media_cols}

    return data, metadata


def create_fourier_features(
    n_periods: int,
    period: int = 52,
    n_harmonics: int = 3,
) -> np.ndarray:
    """
    Create Fourier features for seasonality modeling.

    Args:
        n_periods: Number of time periods
        period: Seasonality period (e.g., 52 for weekly data with annual seasonality)
        n_harmonics: Number of Fourier harmonics to include

    Returns:
        Array of shape (n_periods, 2 * n_harmonics) with sin/cos features
    """
    t = np.arange(n_periods)
    features = []

    for k in range(1, n_harmonics + 1):
        features.append(np.sin(2 * np.pi * k * t / period))
        features.append(np.cos(2 * np.pi * k * t / period))

    return np.column_stack(features)


def create_trend_feature(n_periods: int, normalize: bool = True) -> np.ndarray:
    """
    Create a trend feature.

    Args:
        n_periods: Number of time periods
        normalize: Whether to normalize to [0, 1] range

    Returns:
        Array of shape (n_periods,) with trend values
    """
    trend = np.arange(n_periods, dtype=float)
    if normalize:
        trend = trend / (n_periods - 1)
    return trend


def compute_correlation_matrix(
    df: pd.DataFrame,
    columns: List[str],
) -> pd.DataFrame:
    """
    Compute correlation matrix for specified columns.

    Args:
        df: DataFrame
        columns: Columns to include in correlation matrix

    Returns:
        Correlation matrix as DataFrame
    """
    return df[columns].corr()


def detect_outliers(
    df: pd.DataFrame,
    column: str,
    method: str = "iqr",
    threshold: float = 1.5,
) -> pd.Series:
    """
    Detect outliers in a column.

    Args:
        df: DataFrame
        column: Column to check for outliers
        method: Detection method ('iqr' or 'zscore')
        threshold: Threshold for outlier detection

    Returns:
        Boolean Series indicating outlier rows
    """
    values = df[column]

    if method == "iqr":
        q1 = values.quantile(0.25)
        q3 = values.quantile(0.75)
        iqr = q3 - q1
        lower = q1 - threshold * iqr
        upper = q3 + threshold * iqr
        return (values < lower) | (values > upper)

    elif method == "zscore":
        z_scores = np.abs((values - values.mean()) / values.std())
        return z_scores > threshold

    else:
        raise ValueError(f"Unknown method: {method}")
