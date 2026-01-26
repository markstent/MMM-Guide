"""Session state management for the MMM Dashboard."""

import streamlit as st
from typing import Any, Optional
import pandas as pd


def init_session_state():
    """Initialize all session state variables with defaults."""
    defaults = {
        # Data state
        "data": None,
        "data_filename": None,
        "data_loaded": False,

        # Column mapping
        "date_column": None,
        "target_column": None,
        "media_columns": [],
        "control_columns": [],
        "segment_column": None,
        "segment_value": None,

        # Model configuration
        "model_type": "Log-Log Multiplicative",
        "aggregation": "Weekly",
        "fourier_period": 52,
        "fourier_harmonics": 3,
        "adstock_decay_prior": 0.5,
        "mcmc_draws": 2000,
        "mcmc_tune": 1000,
        "mcmc_chains": 4,

        # Model results
        "model": None,
        "trace": None,
        "model_trained": False,
        "training_progress": 0,

        # Results
        "elasticities": None,
        "contributions": None,
        "roi_estimates": None,
        "model_metrics": None,

        # Optimization
        "optimization_results": None,
        "scenarios": [],

        # UI state
        "current_page": 0,
    }

    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def get_state(key: str, default: Any = None) -> Any:
    """Get a value from session state."""
    return st.session_state.get(key, default)


def set_state(key: str, value: Any) -> None:
    """Set a value in session state."""
    st.session_state[key] = value


def update_state(**kwargs) -> None:
    """Update multiple session state values at once."""
    for key, value in kwargs.items():
        st.session_state[key] = value


def clear_model_state() -> None:
    """Clear all model-related state (useful when data changes)."""
    model_keys = [
        "model", "trace", "model_trained", "training_progress",
        "elasticities", "contributions", "roi_estimates", "model_metrics",
        "optimization_results", "scenarios"
    ]
    for key in model_keys:
        if key in st.session_state:
            st.session_state[key] = None if key != "scenarios" else []
    st.session_state["model_trained"] = False
    st.session_state["training_progress"] = 0


def get_workflow_progress() -> tuple[int, int]:
    """Get current workflow progress (current_step, total_steps)."""
    total_steps = 8

    if not get_state("data_loaded"):
        return 1, total_steps
    if not get_state("date_column"):
        return 2, total_steps
    if not get_state("target_column") or not get_state("media_columns"):
        return 3, total_steps
    if not get_state("model_trained"):
        return 4, total_steps
    if get_state("training_progress", 0) < 100:
        return 5, total_steps
    if not get_state("elasticities"):
        return 6, total_steps
    if not get_state("optimization_results"):
        return 7, total_steps

    return 8, total_steps


def is_step_complete(step: int) -> bool:
    """Check if a workflow step is complete."""
    current, _ = get_workflow_progress()
    return current > step
