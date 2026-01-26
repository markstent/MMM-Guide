"""Model Training Page - Run MCMC sampling."""

import streamlit as st
import pandas as pd
import numpy as np
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from dashboard.utils import init_session_state, get_state, set_state
from dashboard.data import prepare_data_for_modeling, create_fourier_features, create_trend_feature
from dashboard.core import build_loglog_model, build_lift_model, fit_model, compute_model_diagnostics

# Page config
st.set_page_config(page_title="Model Training - MMM Studio", layout="wide")
init_session_state()


def main():
    st.title("Model Training")
    st.caption("Step 5 of 8")

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

    # Get configuration
    df = get_state('data')
    date_col = get_state('date_column')
    target_col = get_state('target_column')
    media_cols = get_state('media_columns')
    control_cols = get_state('control_columns') or []
    model_type = get_state('model_type')
    aggregation = get_state('aggregation')

    st.markdown("---")

    # Pre-training summary
    st.markdown("### Pre-Training Summary")

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric("Model Type", model_type.split()[0])

    with col2:
        st.metric("Media Channels", len(media_cols))

    with col3:
        st.metric("Data Points", len(df))

    with col4:
        draws = get_state('mcmc_draws')
        chains = get_state('mcmc_chains')
        st.metric("Total Samples", f"{draws * chains:,}")

    st.markdown("---")

    # Training controls
    st.markdown("### Training")

    # Check if already trained
    if get_state('model_trained'):
        st.success("Model training complete!")

        # Show diagnostics summary
        trace = get_state('trace')
        if trace:
            diagnostics = compute_model_diagnostics(trace)

            col1, col2, col3 = st.columns(3)

            with col1:
                rhat_status = "✅" if diagnostics['rhat_max'] < 1.05 else "⚠️"
                st.metric("Max R-hat", f"{diagnostics['rhat_max']:.3f} {rhat_status}")

            with col2:
                ess_status = "✅" if diagnostics['ess_min'] > 100 else "⚠️"
                st.metric("Min ESS", f"{diagnostics['ess_min']:.0f} {ess_status}")

            with col3:
                div_status = "✅" if diagnostics['divergences'] == 0 else "⚠️"
                st.metric("Divergences", f"{diagnostics['divergences']} {div_status}")

            if diagnostics['converged']:
                st.success("All convergence diagnostics passed!")
            else:
                st.warning("Some diagnostics indicate potential convergence issues. Consider running longer chains.")

        # Option to retrain
        if st.button("🔄 Retrain Model"):
            set_state('model_trained', False)
            set_state('trace', None)
            set_state('model', None)
            st.rerun()

    else:
        # Training button
        st.info("""
        Click the button below to start model training. This will run Bayesian inference
        using MCMC sampling, which may take several minutes depending on your data size
        and configuration.
        """)

        if st.button("🚀 Start Training", use_container_width=True, type="primary"):
            # Prepare data
            with st.spinner("Preparing data..."):
                prepared_df, metadata = prepare_data_for_modeling(
                    df=df,
                    date_col=date_col,
                    target_col=target_col,
                    media_cols=media_cols,
                    control_cols=control_cols,
                    aggregation=aggregation,
                    segment_col=get_state('segment_column'),
                    segment_value=get_state('segment_value'),
                )

                n_obs = len(prepared_df)

                # Create features
                X_media = prepared_df[media_cols].values
                y = prepared_df[target_col].values

                # Fourier features
                fourier_period = get_state('fourier_period')
                fourier_harmonics = get_state('fourier_harmonics')
                X_fourier = create_fourier_features(n_obs, fourier_period, fourier_harmonics)

                # Trend
                trend = create_trend_feature(n_obs)

            # Build model
            with st.spinner("Building model..."):
                if "Log-Log" in model_type:
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

            # Train model
            st.markdown("**Training Progress**")
            progress_bar = st.progress(0)
            status_text = st.empty()

            draws = get_state('mcmc_draws')
            tune = get_state('mcmc_tune')
            chains = get_state('mcmc_chains')

            status_text.text(f"Running MCMC: {chains} chains × {draws + tune} samples...")

            try:
                # Run sampling
                trace = fit_model(
                    model=model,
                    draws=draws,
                    tune=tune,
                    chains=chains,
                    target_accept=0.9,
                )

                progress_bar.progress(100)
                status_text.text("Training complete!")

                # Store results
                set_state('model', model)
                set_state('trace', trace)
                set_state('model_trained', True)
                set_state('training_progress', 100)

                # Store metadata
                set_state('model_metadata', metadata)

                st.success("Model training completed successfully!")
                time.sleep(1)
                st.rerun()

            except Exception as e:
                st.error(f"Training failed: {str(e)}")
                st.exception(e)

    # Navigation
    st.markdown("---")
    col1, col2, col3 = st.columns([1, 2, 1])

    with col1:
        if st.button("← Back", use_container_width=True):
            st.switch_page("pages/04_Model_Config.py")

    with col3:
        can_proceed = get_state('model_trained')
        if st.button("Next: View Results →", use_container_width=True, disabled=not can_proceed):
            st.switch_page("pages/06_Results.py")


if __name__ == "__main__":
    main()
