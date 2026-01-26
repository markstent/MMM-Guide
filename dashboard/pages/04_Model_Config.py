"""Model Configuration Page - Configure MMM parameters."""

import streamlit as st
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from dashboard.utils import init_session_state, get_state, set_state, DEFAULT_PARAMS

# Page config
st.set_page_config(page_title="Model Configuration - MMM Studio", layout="wide")
init_session_state()


def main():
    st.title("Model Configuration")
    st.caption("Step 4 of 8")

    # Check prerequisites
    if not get_state('data_loaded'):
        st.warning("Please upload data first.")
        if st.button("Go to Data Upload"):
            st.switch_page("pages/01_Data_Upload.py")
        return

    if not get_state('media_columns'):
        st.warning("Please complete column mapping first.")
        if st.button("Go to Column Mapping"):
            st.switch_page("pages/03_Column_Mapping.py")
        return

    st.markdown("""
    Configure your Marketing Mix Model parameters. The model will estimate
    the effect of each media channel on your target KPI.
    """)

    st.markdown("---")

    # Model type selection
    st.markdown("### 📊 Model Type")

    model_type = st.radio(
        "Select model specification",
        options=["Log-Log Multiplicative", "Lift-Factor Multiplicative"],
        index=0,
        horizontal=True,
    )

    set_state('model_type', model_type)

    if model_type == "Log-Log Multiplicative":
        st.info("""
        **Log-Log Model**: `log(sales) = α + Σβᵢ·log(spendᵢ) + seasonality + trend`

        The coefficients (β) are directly interpretable as **elasticities**:
        a 1% increase in channel spend leads to a β% increase in sales.
        """)
    else:
        st.info("""
        **Lift-Factor Model**: `sales = baseline × Π(1 + λᵢ·f(spendᵢ)) × seasonality`

        This model explicitly estimates **adstock decay** and **saturation curves**
        for each channel, providing richer insights into carryover effects.
        """)

    st.markdown("---")

    # Data aggregation
    st.markdown("### 📅 Data Aggregation")

    col1, col2 = st.columns(2)

    with col1:
        aggregation = st.selectbox(
            "Aggregation level",
            options=["Daily", "Weekly", "Monthly"],
            index=1,  # Default to Weekly
            help="How to aggregate your data for modeling"
        )
        set_state('aggregation', aggregation)

    with col2:
        n_periods = len(get_state('data'))
        st.metric("Data Points", f"~{n_periods} periods")

    st.markdown("---")

    # Seasonality settings
    st.markdown("### 🌊 Seasonality")
    st.caption("Model periodic patterns in your data using Fourier features")

    col1, col2 = st.columns(2)

    with col1:
        fourier_period = st.number_input(
            "Seasonality period",
            min_value=4,
            max_value=365,
            value=DEFAULT_PARAMS['fourier_period'],
            help="Number of periods in one seasonal cycle (e.g., 52 for weekly data with annual seasonality)"
        )
        set_state('fourier_period', fourier_period)

    with col2:
        fourier_harmonics = st.slider(
            "Number of harmonics",
            min_value=1,
            max_value=5,
            value=DEFAULT_PARAMS['fourier_harmonics'],
            help="Higher values capture more complex seasonal patterns"
        )
        set_state('fourier_harmonics', fourier_harmonics)

    st.markdown("---")

    # Prior settings
    st.markdown("### 🎲 Prior Configuration")
    st.caption("Set prior beliefs for Bayesian inference")

    with st.expander("Advanced Prior Settings", expanded=False):
        col1, col2 = st.columns(2)

        with col1:
            st.markdown("**Adstock Decay Prior**")
            decay_mean = st.slider(
                "Prior mean",
                min_value=0.1,
                max_value=0.9,
                value=DEFAULT_PARAMS['adstock_decay_prior_mean'],
                step=0.1,
                help="Expected decay rate (higher = longer carryover)"
            )
            decay_sd = st.slider(
                "Prior std dev",
                min_value=0.05,
                max_value=0.3,
                value=DEFAULT_PARAMS['adstock_decay_prior_sd'],
                step=0.05,
            )
            set_state('adstock_decay_prior', decay_mean)

        with col2:
            st.markdown("**Elasticity Prior**")
            st.info("""
            Elasticity priors are set to Half-Normal(0, 0.3) by default,
            encoding the belief that advertising effects are positive
            but typically small (most elasticities are < 0.3).
            """)

    st.markdown("---")

    # MCMC settings
    st.markdown("### ⚙️ MCMC Settings")
    st.caption("Configure the Bayesian inference algorithm")

    preset = st.radio(
        "Sampling preset",
        options=["Quick (testing)", "Standard", "Thorough"],
        index=1,
        horizontal=True,
    )

    if preset == "Quick (testing)":
        draws, tune, chains = 500, 500, 2
    elif preset == "Standard":
        draws, tune, chains = 2000, 1000, 4
    else:
        draws, tune, chains = 4000, 2000, 4

    col1, col2, col3 = st.columns(3)

    with col1:
        draws = st.number_input(
            "Posterior draws",
            min_value=100,
            max_value=10000,
            value=draws,
            step=500,
            help="Number of samples per chain"
        )
        set_state('mcmc_draws', draws)

    with col2:
        tune = st.number_input(
            "Tuning samples",
            min_value=100,
            max_value=5000,
            value=tune,
            step=500,
            help="Samples used to tune the sampler (discarded)"
        )
        set_state('mcmc_tune', tune)

    with col3:
        chains = st.number_input(
            "Chains",
            min_value=1,
            max_value=8,
            value=chains,
            help="Independent MCMC chains"
        )
        set_state('mcmc_chains', chains)

    # Estimated time
    total_samples = draws * chains + tune * chains
    st.caption(f"Total samples: {total_samples:,} (estimated time varies by hardware)")

    st.markdown("---")

    # Configuration summary
    st.markdown("### 📋 Configuration Summary")

    media_cols = get_state('media_columns')

    col1, col2 = st.columns(2)

    with col1:
        st.markdown(f"""
        **Model Specification:**
        - Type: {model_type}
        - Aggregation: {aggregation}
        - Seasonality: {fourier_harmonics} harmonics, period={fourier_period}
        """)

    with col2:
        st.markdown(f"""
        **MCMC Settings:**
        - Draws: {draws}
        - Tune: {tune}
        - Chains: {chains}
        - Total Samples: {total_samples:,}
        """)

    st.markdown(f"**Media Channels:** {', '.join(media_cols)}")

    # Navigation
    st.markdown("---")
    col1, col2, col3 = st.columns([1, 2, 1])

    with col1:
        if st.button("← Back", use_container_width=True):
            st.switch_page("pages/03_Column_Mapping.py")

    with col3:
        if st.button("Next: Train Model →", use_container_width=True):
            st.switch_page("pages/05_Model_Training.py")


if __name__ == "__main__":
    main()
