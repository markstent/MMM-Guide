"""Attribution and contribution calculation for MMM."""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from itertools import combinations


def compute_channel_contributions_loglog(
    trace_posterior: Dict[str, np.ndarray],
    X_media_log: np.ndarray,
    y_mean: float,
    channel_names: List[str],
) -> Dict[str, Dict[str, float]]:
    """
    Compute channel contributions from a log-log model.

    In a log-log model, the contribution of each channel can be estimated
    from the elasticity and the channel's share of total media effect.

    Args:
        trace_posterior: Dictionary with posterior samples (from trace.posterior)
        X_media_log: Log-transformed media spend, shape (n_periods, n_channels)
        y_mean: Mean of target variable
        channel_names: Names of media channels

    Returns:
        Dictionary with contribution statistics per channel
    """
    # Get elasticity posterior samples
    betas = trace_posterior['beta']  # Shape: (chains, draws, n_channels)

    # Flatten chains and draws
    if betas.ndim == 3:
        betas = betas.reshape(-1, betas.shape[-1])  # (n_samples, n_channels)

    contributions = {}

    for i, channel in enumerate(channel_names):
        beta_samples = betas[:, i]

        # Calculate contribution as elasticity * mean log spend * y_mean
        # This gives an approximation of the absolute contribution
        mean_log_spend = X_media_log[:, i].mean()
        contribution_samples = beta_samples * mean_log_spend * y_mean

        contributions[channel] = {
            'elasticity_mean': float(beta_samples.mean()),
            'elasticity_std': float(beta_samples.std()),
            'elasticity_ci_lower': float(np.percentile(beta_samples, 3)),
            'elasticity_ci_upper': float(np.percentile(beta_samples, 97)),
            'contribution_mean': float(contribution_samples.mean()),
            'contribution_std': float(contribution_samples.std()),
        }

    return contributions


def compute_shapley_values(
    baseline: float,
    channel_effects: Dict[str, float],
) -> Dict[str, float]:
    """
    Compute Shapley values for fair attribution.

    Shapley values provide a game-theoretic fair allocation of the
    total effect among channels, accounting for interaction effects.

    Args:
        baseline: Baseline sales (without any media)
        channel_effects: Dictionary mapping channel names to their individual effects

    Returns:
        Dictionary of Shapley values per channel
    """
    channels = list(channel_effects.keys())
    n = len(channels)

    if n == 0:
        return {}

    if n > 10:
        # For many channels, use sampling approximation
        return _shapley_sampling(baseline, channel_effects, n_samples=1000)

    # Exact computation for small number of channels
    shapley = {ch: 0.0 for ch in channels}

    def value_function(coalition: set) -> float:
        """Value of a coalition of channels."""
        if not coalition:
            return baseline
        total = baseline
        for ch in coalition:
            total += channel_effects[ch]
        return total

    # Compute Shapley value for each channel
    for channel in channels:
        marginal_sum = 0.0
        others = [ch for ch in channels if ch != channel]

        # Iterate over all subsets of other channels
        for k in range(len(others) + 1):
            for subset in combinations(others, k):
                subset_set = set(subset)
                with_channel = subset_set | {channel}

                # Marginal contribution
                marginal = value_function(with_channel) - value_function(subset_set)

                # Weight: |S|! * (n - |S| - 1)! / n!
                weight = (
                    np.math.factorial(len(subset_set)) *
                    np.math.factorial(n - len(subset_set) - 1) /
                    np.math.factorial(n)
                )

                marginal_sum += weight * marginal

        shapley[channel] = marginal_sum

    return shapley


def _shapley_sampling(
    baseline: float,
    channel_effects: Dict[str, float],
    n_samples: int = 1000,
) -> Dict[str, float]:
    """
    Approximate Shapley values using sampling.

    Used when the number of channels is too large for exact computation.
    """
    channels = list(channel_effects.keys())
    n = len(channels)
    shapley = {ch: 0.0 for ch in channels}

    rng = np.random.default_rng(42)

    for _ in range(n_samples):
        # Random permutation
        perm = rng.permutation(channels)

        # Compute marginal contributions along the permutation
        current_value = baseline
        for channel in perm:
            new_value = current_value + channel_effects[channel]
            shapley[channel] += (new_value - current_value)
            current_value = new_value

    # Average
    for ch in channels:
        shapley[ch] /= n_samples

    return shapley


def decompose_sales(
    y: np.ndarray,
    baseline: np.ndarray,
    channel_contributions: Dict[str, np.ndarray],
    seasonality: Optional[np.ndarray] = None,
    trend: Optional[np.ndarray] = None,
) -> pd.DataFrame:
    """
    Decompose sales into components.

    Args:
        y: Actual sales values
        baseline: Baseline (intercept) component
        channel_contributions: Dictionary mapping channel names to contribution arrays
        seasonality: Optional seasonality component
        trend: Optional trend component

    Returns:
        DataFrame with decomposition
    """
    n = len(y)

    data = {
        'actual': y,
        'baseline': baseline if len(baseline) == n else np.full(n, baseline),
    }

    for channel, contrib in channel_contributions.items():
        data[f'channel_{channel}'] = contrib

    if seasonality is not None:
        data['seasonality'] = seasonality

    if trend is not None:
        data['trend'] = trend

    # Calculate fitted and residual
    fitted = data['baseline'].copy()
    for key in data:
        if key.startswith('channel_') or key in ['seasonality', 'trend']:
            fitted = fitted + data[key]

    data['fitted'] = fitted
    data['residual'] = y - fitted

    return pd.DataFrame(data)


def calculate_roi(
    channel_contributions: Dict[str, float],
    channel_spend: Dict[str, float],
    credible_intervals: Optional[Dict[str, Tuple[float, float]]] = None,
) -> pd.DataFrame:
    """
    Calculate ROI for each channel.

    Args:
        channel_contributions: Revenue/sales attributed to each channel
        channel_spend: Total spend per channel
        credible_intervals: Optional CI for contributions

    Returns:
        DataFrame with ROI metrics
    """
    data = []

    for channel in channel_contributions:
        contrib = channel_contributions[channel]
        spend = channel_spend.get(channel, 0)

        roi = contrib / spend if spend > 0 else 0

        row = {
            'channel': channel,
            'spend': spend,
            'contribution': contrib,
            'roi': roi,
        }

        if credible_intervals and channel in credible_intervals:
            ci_low, ci_high = credible_intervals[channel]
            row['roi_ci_lower'] = ci_low / spend if spend > 0 else 0
            row['roi_ci_upper'] = ci_high / spend if spend > 0 else 0

        data.append(row)

    return pd.DataFrame(data)
