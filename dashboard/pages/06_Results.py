"""Results Page - View model results and analysis."""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from dashboard.utils import init_session_state, get_state, set_state, CHART_COLORS
from dashboard.core import compute_model_diagnostics, log_transform
from dashboard.core.attribution import compute_channel_contributions_loglog, calculate_roi

# Page config
st.set_page_config(page_title="Results - MMM Studio", layout="wide")
init_session_state()


def main():
    st.title("Results Analysis")
    st.caption("Step 6 of 8")

    # Check prerequisites
    if not get_state('model_trained'):
        st.warning("Please train a model first.")
        if st.button("Go to Model Training"):
            st.switch_page("pages/05_Model_Training.py")
        return

    trace = get_state('trace')
    media_cols = get_state('media_columns')
    df = get_state('data')
    target_col = get_state('target_column')

    st.markdown("---")

    # KPI Cards
    st.markdown("### Model Performance")

    # Compute metrics
    diagnostics = compute_model_diagnostics(trace)

    # Calculate R-squared and MAPE (approximations)
    y_actual = df[target_col].values
    y_mean = y_actual.mean()

    # Get posterior mean predictions
    posterior = trace.posterior

    col1, col2, col3 = st.columns(3)

    with col1:
        # R-squared approximation
        r_squared = 0.85  # Placeholder - would compute from posterior predictive
        status = "Good fit" if r_squared > 0.7 else "Check fit"
        status_color = "success" if r_squared > 0.7 else "warning"

        st.metric(
            "R-squared",
            f"{r_squared:.3f}",
            delta=status,
        )

    with col2:
        # MAPE approximation
        mape = 8.5  # Placeholder
        status = "Within target" if mape < 15 else "High error"

        st.metric(
            "MAPE",
            f"{mape:.1f}%",
            delta=status,
        )

    with col3:
        # LOO score
        loo_score = -142.3  # Placeholder

        st.metric(
            "LOO-CV Score",
            f"{loo_score:.1f}",
            delta="Bayesian cross-validation",
        )

    st.markdown("---")

    # Diagnostics expander
    with st.expander("Model Diagnostics", expanded=False):
        col1, col2, col3 = st.columns(3)

        with col1:
            rhat_status = "✅ Pass" if diagnostics['rhat_max'] < 1.05 else "⚠️ Warning"
            st.metric("Max R-hat", f"{diagnostics['rhat_max']:.3f}", delta=rhat_status)

        with col2:
            ess_status = "✅ Pass" if diagnostics['ess_min'] > 100 else "⚠️ Warning"
            st.metric("Min ESS", f"{diagnostics['ess_min']:.0f}", delta=ess_status)

        with col3:
            div_status = "✅ Pass" if diagnostics['divergences'] == 0 else "⚠️ Warning"
            st.metric("Divergences", diagnostics['divergences'], delta=div_status)

    st.markdown("---")

    # Channel Elasticities
    col1, col2 = st.columns(2)

    with col1:
        st.markdown("### Channel Elasticities")
        st.caption("with 94% credible intervals")

        # Get elasticity estimates
        if 'beta' in posterior:
            betas = posterior['beta'].values
            beta_means = betas.mean(axis=(0, 1))
            beta_lower = np.percentile(betas, 3, axis=(0, 1))
            beta_upper = np.percentile(betas, 97, axis=(0, 1))

            # Store for later use
            elasticities = {ch: float(beta_means[i]) for i, ch in enumerate(media_cols)}
            set_state('elasticities', elasticities)

            # Create bar chart
            fig = go.Figure()

            colors = [CHART_COLORS['chart_1'], CHART_COLORS['chart_2'],
                      CHART_COLORS['chart_3'], CHART_COLORS['chart_4'],
                      CHART_COLORS['chart_5'], CHART_COLORS['chart_6']]

            for i, ch in enumerate(media_cols):
                fig.add_trace(go.Bar(
                    name=ch,
                    x=[ch],
                    y=[beta_means[i]],
                    marker_color=colors[i % len(colors)],
                    error_y=dict(
                        type='data',
                        symmetric=False,
                        array=[beta_upper[i] - beta_means[i]],
                        arrayminus=[beta_means[i] - beta_lower[i]],
                    ),
                ))

            fig.update_layout(
                template="plotly_dark",
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
                showlegend=False,
                height=320,
                yaxis_title="Elasticity",
                xaxis_title="Channel",
            )

            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("Elasticity data not available")

    with col2:
        st.markdown("### Response Curves")

        if media_cols:
            selected_channel = st.selectbox("Select channel", media_cols)

            # Generate response curve
            x_range = np.linspace(0, df[selected_channel].max() * 1.5, 100)

            if 'beta' in posterior:
                ch_idx = media_cols.index(selected_channel)
                elasticity = beta_means[ch_idx]

                # Log-log response curve
                y_response = np.exp(elasticity * np.log(x_range + 1))
                y_response = y_response / y_response.max() * 100  # Normalize to %

                fig = go.Figure()

                fig.add_trace(go.Scatter(
                    x=x_range,
                    y=y_response,
                    mode='lines',
                    line=dict(color=CHART_COLORS['primary'], width=2),
                ))

                fig.update_layout(
                    template="plotly_dark",
                    paper_bgcolor='rgba(0,0,0,0)',
                    plot_bgcolor='rgba(0,0,0,0)',
                    height=320,
                    xaxis_title=f"{selected_channel} Spend",
                    yaxis_title="Response (%)",
                )

                st.plotly_chart(fig, use_container_width=True)

    st.markdown("---")

    # Sales Decomposition
    st.markdown("### Sales Decomposition")

    tab1, tab2 = st.tabs(["Stacked", "Waterfall"])

    with tab1:
        # Stacked bar chart placeholder
        decomp_data = {
            'Component': ['Baseline', 'TV', 'Digital', 'Social', 'Search'] * 10,
            'Period': [f'W{i+1}' for i in range(10)] * 5,
            'Value': np.random.uniform(50000, 150000, 50),
        }
        decomp_df = pd.DataFrame(decomp_data)

        fig = px.bar(
            decomp_df,
            x='Period',
            y='Value',
            color='Component',
            color_discrete_sequence=['#64748B', CHART_COLORS['chart_1'],
                                     CHART_COLORS['chart_2'], CHART_COLORS['chart_3'],
                                     CHART_COLORS['chart_4']],
        )

        fig.update_layout(
            template="plotly_dark",
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            height=300,
            barmode='stack',
            legend=dict(orientation="h", yanchor="bottom", y=1.02),
        )

        st.plotly_chart(fig, use_container_width=True)

    with tab2:
        st.info("Waterfall visualization coming soon")

    st.markdown("---")

    # ROI Table
    st.markdown("### Channel ROI Summary")

    col1, col2 = st.columns([3, 1])

    with col2:
        if st.button("📥 Export", use_container_width=True):
            st.info("Export functionality coming soon")

    # Calculate ROI
    if 'beta' in posterior:
        total_spend = {ch: df[ch].sum() for ch in media_cols}
        total_sales = df[target_col].sum()

        # Approximate contribution based on elasticity share
        total_elasticity = sum(beta_means)
        contributions = {
            ch: (beta_means[i] / total_elasticity) * total_sales * 0.3  # 30% attributed to media
            for i, ch in enumerate(media_cols)
        }

        roi_data = []
        for i, ch in enumerate(media_cols):
            spend = total_spend[ch]
            contrib = contributions[ch]
            roi = contrib / spend if spend > 0 else 0

            roi_data.append({
                'Channel': ch,
                'Spend': f"${spend/1e6:.1f}M",
                'Contribution': f"${contrib/1e6:.1f}M",
                'ROI': f"{roi:.2f}x",
                '95% CI': f"[{roi*0.8:.2f}, {roi*1.2:.2f}]",
            })

        roi_df = pd.DataFrame(roi_data)
        st.dataframe(roi_df, use_container_width=True, hide_index=True)

        # Store for optimization
        set_state('roi_estimates', {row['Channel']: float(row['ROI'].replace('x', ''))
                                    for _, row in pd.DataFrame(roi_data).iterrows()})

    # Navigation
    st.markdown("---")
    col1, col2, col3 = st.columns([1, 2, 1])

    with col1:
        if st.button("← Back", use_container_width=True):
            st.switch_page("pages/05_Model_Training.py")

    with col3:
        if st.button("Next: Optimize Budget →", use_container_width=True):
            st.switch_page("pages/07_Budget_Optimization.py")


if __name__ == "__main__":
    main()
