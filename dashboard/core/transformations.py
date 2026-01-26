"""Marketing mix model transformations: adstock and saturation functions."""

import numpy as np
from typing import Optional, Union
import pytensor.tensor as pt


def geometric_adstock(
    x: np.ndarray,
    decay_rate: float,
    normalize: bool = True,
) -> np.ndarray:
    """
    Apply geometric adstock transformation.

    The adstock effect models the carryover of advertising impact over time.
    Each period's effect is the current spend plus a decayed portion of
    the previous period's adstocked value.

    Args:
        x: Array of spend values, shape (n_periods,)
        decay_rate: Decay rate between 0 and 1. Higher values = longer carryover.
        normalize: Whether to normalize by (1 - decay_rate) to maintain scale.

    Returns:
        Adstocked values, same shape as input.
    """
    n = len(x)
    adstocked = np.zeros(n)
    adstocked[0] = x[0]

    for t in range(1, n):
        adstocked[t] = x[t] + decay_rate * adstocked[t - 1]

    if normalize:
        adstocked = adstocked * (1 - decay_rate)

    return adstocked


def geometric_adstock_matrix(
    X: np.ndarray,
    decay_rates: Union[float, np.ndarray],
    normalize: bool = True,
) -> np.ndarray:
    """
    Apply geometric adstock to multiple channels.

    Args:
        X: Array of spend values, shape (n_periods, n_channels)
        decay_rates: Single decay rate or array of rates per channel
        normalize: Whether to normalize

    Returns:
        Adstocked values, same shape as input.
    """
    n_periods, n_channels = X.shape

    if isinstance(decay_rates, (int, float)):
        decay_rates = np.full(n_channels, decay_rates)

    result = np.zeros_like(X)
    for j in range(n_channels):
        result[:, j] = geometric_adstock(X[:, j], decay_rates[j], normalize)

    return result


def hill_function(
    x: np.ndarray,
    K: float,
    S: float,
) -> np.ndarray:
    """
    Apply Hill function (saturation/diminishing returns).

    The Hill function models diminishing returns as spend increases.
    It's an S-curve that starts at 0, increases, and asymptotes to 1.

    Args:
        x: Input values (typically adstocked spend)
        K: Half-saturation point (spend level at 50% saturation)
        S: Shape parameter (steepness of the curve)

    Returns:
        Saturated values in [0, 1] range.
    """
    return x ** S / (K ** S + x ** S)


def hill_function_scaled(
    x: np.ndarray,
    K: float,
    S: float,
    max_effect: float = 1.0,
) -> np.ndarray:
    """
    Apply Hill function with scaling.

    Args:
        x: Input values
        K: Half-saturation point
        S: Shape parameter
        max_effect: Maximum effect (scales the output)

    Returns:
        Scaled saturated values.
    """
    return max_effect * hill_function(x, K, S)


def log_transform(
    x: np.ndarray,
    offset: float = 1.0,
) -> np.ndarray:
    """
    Apply log transformation with offset.

    Used in log-log models to handle zeros and enable
    interpretation as elasticities.

    Args:
        x: Input values
        offset: Offset to add before log (handles zeros)

    Returns:
        Log-transformed values.
    """
    return np.log(x + offset)


def inverse_log_transform(
    x: np.ndarray,
    offset: float = 1.0,
) -> np.ndarray:
    """
    Inverse of log transformation.

    Args:
        x: Log-transformed values
        offset: Offset used in forward transform

    Returns:
        Original scale values.
    """
    return np.exp(x) - offset


# PyTensor versions for use in PyMC models

def pt_geometric_adstock(
    x: pt.TensorVariable,
    decay_rate: pt.TensorVariable,
    normalize: bool = True,
) -> pt.TensorVariable:
    """
    PyTensor version of geometric adstock for PyMC models.

    Uses scan for the recursive computation.
    """
    def step(x_t, adstock_prev, decay):
        return x_t + decay * adstock_prev

    adstocked, _ = pt.scan(
        fn=step,
        sequences=[x],
        outputs_info=[pt.zeros(())],
        non_sequences=[decay_rate],
    )

    if normalize:
        adstocked = adstocked * (1 - decay_rate)

    return adstocked


def pt_hill_function(
    x: pt.TensorVariable,
    K: pt.TensorVariable,
    S: pt.TensorVariable,
) -> pt.TensorVariable:
    """
    PyTensor version of Hill function for PyMC models.
    """
    return x ** S / (K ** S + x ** S)
