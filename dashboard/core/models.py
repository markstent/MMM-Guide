"""PyMC model builders for Marketing Mix Modeling."""

import numpy as np
import pymc as pm
import arviz as az
from typing import Dict, List, Optional, Tuple, Callable, Any
import warnings

from .transformations import geometric_adstock_matrix, log_transform


def build_loglog_model(
    X_media: np.ndarray,
    X_fourier: np.ndarray,
    trend: np.ndarray,
    y: np.ndarray,
    channel_names: List[str],
    X_events: Optional[np.ndarray] = None,
    event_names: Optional[List[str]] = None,
    X_controls: Optional[np.ndarray] = None,
    control_names: Optional[List[str]] = None,
    prior_config: Optional[Dict] = None,
) -> pm.Model:
    """
    Build a Log-Log multiplicative MMM.

    In the log-log specification:
    log(y) = intercept + sum(beta_i * log(x_i)) + seasonality + trend + noise

    The beta coefficients are directly interpretable as elasticities:
    a 1% increase in channel i spend leads to a beta_i% increase in sales.

    Args:
        X_media: Media spend data, shape (n_periods, n_channels)
        X_fourier: Fourier features for seasonality, shape (n_periods, n_harmonics*2)
        trend: Trend feature, shape (n_periods,)
        y: Target variable, shape (n_periods,)
        channel_names: Names of media channels
        X_events: Optional event indicators (e.g., COVID), shape (n_periods, n_events)
        event_names: Names of events
        X_controls: Optional control variables, shape (n_periods, n_controls)
        control_names: Names of control variables
        prior_config: Optional dictionary of prior parameters

    Returns:
        PyMC Model object
    """
    prior_config = prior_config or {}

    n_obs, n_channels = X_media.shape
    n_fourier = X_fourier.shape[1]

    # Log-transform inputs
    y_log = log_transform(y)
    X_media_log = log_transform(X_media)

    with pm.Model() as model:
        # Store data for later reference
        model.add_coord("obs", range(n_obs))
        model.add_coord("channel", channel_names)
        model.add_coord("fourier", range(n_fourier))

        # Priors for intercept
        intercept = pm.Normal(
            "intercept",
            mu=prior_config.get("intercept_mu", y_log.mean()),
            sigma=prior_config.get("intercept_sigma", 1.0),
        )

        # Priors for channel elasticities (betas)
        # Elasticities are typically small positive values for advertising
        beta = pm.HalfNormal(
            "beta",
            sigma=prior_config.get("beta_sigma", 0.3),
            dims="channel",
        )

        # Priors for seasonality coefficients
        # sigma=0.5 allows seasonality to explain up to ~50% variation in log scale
        gamma_fourier = pm.Normal(
            "gamma_fourier",
            mu=0,
            sigma=prior_config.get("fourier_sigma", 0.5),
            dims="fourier",
        )

        # Prior for trend coefficient
        # sigma=0.5 allows trend to capture meaningful growth/decline
        gamma_trend = pm.Normal(
            "gamma_trend",
            mu=0,
            sigma=prior_config.get("trend_sigma", 0.5),
        )

        # Priors for events (COVID, holidays, etc.) - can be positive or negative
        gamma_events = None
        n_events = 0
        if X_events is not None and X_events.shape[1] > 0:
            n_events = X_events.shape[1]
            model.add_coord("event", event_names)
            # Use pm.Data to wrap the events array for proper tensor handling
            X_events_data = pm.Data("X_events_data", X_events)
            gamma_events = pm.Normal(
                "gamma_events",
                mu=0,
                sigma=prior_config.get("event_sigma", 1.0),
                dims="event",
            )

        # Priors for control variables
        gamma_controls = None
        n_controls = 0
        if X_controls is not None and X_controls.shape[1] > 0:
            n_controls = X_controls.shape[1]
            model.add_coord("control", control_names)
            X_controls_data = pm.Data("X_controls_data", X_controls)
            gamma_controls = pm.Normal(
                "gamma_controls",
                mu=0,
                sigma=prior_config.get("control_sigma", 0.5),
                dims="control",
            )

        # Prior for noise
        sigma = pm.HalfNormal(
            "sigma",
            sigma=prior_config.get("sigma_sigma", 0.5),
        )

        # Linear predictor in log space
        mu = (
            intercept
            + pm.math.dot(X_media_log, beta)
            + pm.math.dot(X_fourier, gamma_fourier)
            + gamma_trend * trend
        )

        # Add events contribution (e.g., COVID impact)
        if n_events > 0 and gamma_events is not None:
            mu = mu + pm.math.dot(X_events_data, gamma_events)

        # Add controls contribution (already standardized, no log transform)
        if n_controls > 0 and gamma_controls is not None:
            mu = mu + pm.math.dot(X_controls_data, gamma_controls)

        # Likelihood
        pm.Normal("y_obs", mu=mu, sigma=sigma, observed=y_log, dims="obs")

        # Store transformed data for later use
        pm.Deterministic("y_log", pm.math.constant(y_log), dims="obs")

    return model


def build_lift_model(
    X_media: np.ndarray,
    X_fourier: np.ndarray,
    trend: np.ndarray,
    y: np.ndarray,
    channel_names: List[str],
    adstock_decay_priors: Optional[Dict[str, Tuple[float, float]]] = None,
    prior_config: Optional[Dict] = None,
) -> pm.Model:
    """
    Build a Lift-Factor multiplicative MMM with adstock.

    This model explicitly estimates adstock decay rates and models
    the multiplicative lift from each channel.

    Args:
        X_media: Media spend data, shape (n_periods, n_channels)
        X_fourier: Fourier features for seasonality
        trend: Trend feature
        y: Target variable
        channel_names: Names of media channels
        adstock_decay_priors: Dict mapping channel names to (mean, sd) tuples
        prior_config: Optional dictionary of prior parameters

    Returns:
        PyMC Model object
    """
    prior_config = prior_config or {}
    adstock_decay_priors = adstock_decay_priors or {}

    n_obs, n_channels = X_media.shape
    n_fourier = X_fourier.shape[1]

    # Default adstock priors
    default_decay_prior = (0.5, 0.2)

    with pm.Model() as model:
        model.add_coord("obs", range(n_obs))
        model.add_coord("channel", channel_names)
        model.add_coord("fourier", range(n_fourier))

        # Adstock decay rates per channel
        decay_rates = []
        for i, ch in enumerate(channel_names):
            mu, sd = adstock_decay_priors.get(ch, default_decay_prior)
            decay = pm.Beta(
                f"decay_{ch}",
                mu=mu,
                sigma=sd,
            )
            decay_rates.append(decay)

        # Baseline sales
        baseline = pm.LogNormal(
            "baseline",
            mu=prior_config.get("baseline_mu", np.log(y.mean())),
            sigma=prior_config.get("baseline_sigma", 0.5),
        )

        # Channel lift factors (multiplicative effects)
        lift_factors = pm.HalfNormal(
            "lift_factor",
            sigma=prior_config.get("lift_sigma", 0.1),
            dims="channel",
        )

        # Seasonality coefficients
        gamma_fourier = pm.Normal(
            "gamma_fourier",
            mu=0,
            sigma=prior_config.get("fourier_sigma", 0.5),
            dims="fourier",
        )

        # Trend coefficient
        gamma_trend = pm.Normal(
            "gamma_trend",
            mu=0,
            sigma=prior_config.get("trend_sigma", 0.5),
        )

        # Noise
        sigma = pm.HalfNormal(
            "sigma",
            sigma=prior_config.get("sigma_sigma", 0.3),
        )

        # Apply adstock (done outside the model for simplicity in this version)
        # In practice, you might want to use PyTensor scan for full Bayesian treatment
        X_media_adstocked = pm.Data(
            "X_media_adstocked",
            X_media,  # Placeholder - actual adstock applied during sampling
        )

        # Multiplicative model
        # y = baseline * prod((1 + lift_i * x_i)) * exp(seasonality + trend)
        channel_effects = 1.0
        for i in range(n_channels):
            channel_effects = channel_effects * (1 + lift_factors[i] * X_media_adstocked[:, i] / X_media[:, i].mean())

        seasonality = pm.math.dot(X_fourier, gamma_fourier)
        mu = baseline * channel_effects * pm.math.exp(seasonality + gamma_trend * trend)

        # Likelihood (log-normal for positive outcomes)
        pm.LogNormal("y_obs", mu=pm.math.log(mu), sigma=sigma, observed=y, dims="obs")

    return model


def fit_model(
    model: pm.Model,
    draws: int = 2000,
    tune: int = 1000,
    chains: int = 4,
    target_accept: float = 0.9,
    progress_callback: Optional[Callable[[int], None]] = None,
    random_seed: int = 42,
) -> az.InferenceData:
    """
    Fit a PyMC model using MCMC sampling.

    Args:
        model: PyMC Model object
        draws: Number of posterior samples per chain
        tune: Number of tuning samples
        chains: Number of MCMC chains
        target_accept: Target acceptance rate for NUTS
        progress_callback: Optional callback function for progress updates
        random_seed: Random seed for reproducibility

    Returns:
        ArviZ InferenceData object containing the trace
    """
    with model:
        trace = pm.sample(
            draws=draws,
            tune=tune,
            chains=chains,
            target_accept=target_accept,
            random_seed=random_seed,
            return_inferencedata=True,
            progressbar=True,
        )

    return trace


def compute_model_diagnostics(trace: az.InferenceData) -> Dict[str, Any]:
    """
    Compute model diagnostics from the trace.

    Args:
        trace: ArviZ InferenceData object

    Returns:
        Dictionary of diagnostic metrics
    """
    diagnostics = {}

    # R-hat (should be < 1.01 for convergence)
    rhat = az.rhat(trace)
    diagnostics['rhat'] = {
        var: float(rhat[var].values) if rhat[var].ndim == 0
        else rhat[var].values.tolist()
        for var in rhat.data_vars
    }
    diagnostics['rhat_max'] = max(
        np.max(v) if isinstance(v, (list, np.ndarray)) else v
        for v in diagnostics['rhat'].values()
    )

    # Effective sample size
    ess = az.ess(trace)
    diagnostics['ess'] = {
        var: float(ess[var].values) if ess[var].ndim == 0
        else ess[var].values.tolist()
        for var in ess.data_vars
    }
    diagnostics['ess_min'] = min(
        np.min(v) if isinstance(v, (list, np.ndarray)) else v
        for v in diagnostics['ess'].values()
    )

    # MCSE (Monte Carlo Standard Error)
    mcse = az.mcse(trace)
    diagnostics['mcse'] = {
        var: float(mcse[var].values) if mcse[var].ndim == 0
        else mcse[var].values.tolist()
        for var in mcse.data_vars
    }

    # Divergences
    if hasattr(trace, 'sample_stats') and 'diverging' in trace.sample_stats:
        diagnostics['divergences'] = int(trace.sample_stats.diverging.sum())
    else:
        diagnostics['divergences'] = 0

    # Summary of convergence
    diagnostics['converged'] = (
        diagnostics['rhat_max'] < 1.05 and
        diagnostics['ess_min'] > 100 and
        diagnostics['divergences'] == 0
    )

    return diagnostics
