"""Reusable chart components for the MMM Dashboard."""

import plotly.graph_objects as go
import plotly.express as px
import numpy as np
import pandas as pd
from typing import List, Dict, Optional

from dashboard.utils import CHART_COLORS, THEME_COLORS


def create_time_series_chart(
    df: pd.DataFrame,
    x_col: str,
    y_cols: List[str],
    title: Optional[str] = None,
    height: int = 400,
) -> go.Figure:
    """Create a multi-line time series chart."""
    fig = go.Figure()

    colors = list(CHART_COLORS.values())

    for i, col in enumerate(y_cols):
        fig.add_trace(go.Scatter(
            x=df[x_col],
            y=df[col],
            name=col,
            line=dict(color=colors[i % len(colors)]),
        ))

    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        title=title,
        xaxis_title=x_col,
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
        height=height,
    )

    return fig


def create_bar_chart_with_ci(
    categories: List[str],
    values: List[float],
    lower_ci: List[float],
    upper_ci: List[float],
    title: Optional[str] = None,
    height: int = 320,
) -> go.Figure:
    """Create a bar chart with confidence intervals."""
    fig = go.Figure()

    colors = list(CHART_COLORS.values())

    for i, (cat, val, lower, upper) in enumerate(zip(categories, values, lower_ci, upper_ci)):
        fig.add_trace(go.Bar(
            name=cat,
            x=[cat],
            y=[val],
            marker_color=colors[i % len(colors)],
            error_y=dict(
                type='data',
                symmetric=False,
                array=[upper - val],
                arrayminus=[val - lower],
            ),
        ))

    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        title=title,
        showlegend=False,
        height=height,
    )

    return fig


def create_stacked_area_chart(
    df: pd.DataFrame,
    x_col: str,
    y_cols: List[str],
    title: Optional[str] = None,
    height: int = 300,
) -> go.Figure:
    """Create a stacked area chart for decomposition."""
    fig = go.Figure()

    colors = ['#64748B'] + list(CHART_COLORS.values())  # Baseline + channels

    for i, col in enumerate(y_cols):
        fig.add_trace(go.Scatter(
            x=df[x_col],
            y=df[col],
            name=col,
            mode='lines',
            stackgroup='one',
            fillcolor=colors[i % len(colors)],
            line=dict(width=0),
        ))

    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        title=title,
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
        height=height,
    )

    return fig


def create_pie_chart(
    labels: List[str],
    values: List[float],
    title: Optional[str] = None,
    height: int = 300,
    hole: float = 0.4,
) -> go.Figure:
    """Create a donut/pie chart."""
    colors = list(CHART_COLORS.values())

    fig = go.Figure(data=[go.Pie(
        labels=labels,
        values=values,
        hole=hole,
        marker_colors=colors[:len(labels)],
    )])

    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor='rgba(0,0,0,0)',
        title=title,
        height=height,
        margin=dict(t=30, b=0, l=0, r=0),
    )

    return fig


def create_correlation_heatmap(
    corr_matrix: pd.DataFrame,
    title: Optional[str] = None,
    height: int = 500,
) -> go.Figure:
    """Create a correlation matrix heatmap."""
    fig = px.imshow(
        corr_matrix,
        text_auto='.2f',
        color_continuous_scale='RdBu_r',
        zmin=-1,
        zmax=1,
    )

    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        title=title,
        height=height,
    )

    return fig


def create_response_curve(
    x_values: np.ndarray,
    y_values: np.ndarray,
    channel_name: str,
    current_spend: Optional[float] = None,
    height: int = 320,
) -> go.Figure:
    """Create a response curve visualization."""
    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=x_values,
        y=y_values,
        mode='lines',
        line=dict(color=CHART_COLORS['primary'], width=2),
        name='Response',
    ))

    if current_spend is not None:
        # Find y value at current spend
        idx = np.argmin(np.abs(x_values - current_spend))
        current_y = y_values[idx]

        fig.add_trace(go.Scatter(
            x=[current_spend],
            y=[current_y],
            mode='markers',
            marker=dict(color=CHART_COLORS['warning'], size=10),
            name='Current',
        ))

    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        title=f"{channel_name} Response Curve",
        xaxis_title="Spend",
        yaxis_title="Response",
        height=height,
    )

    return fig


def create_waterfall_chart(
    categories: List[str],
    values: List[float],
    title: Optional[str] = None,
    height: int = 300,
) -> go.Figure:
    """Create a waterfall chart for contribution analysis."""
    # Determine measure type (relative vs total)
    measure = ['relative'] * (len(categories) - 1) + ['total']

    fig = go.Figure(go.Waterfall(
        name="Contribution",
        orientation="v",
        measure=measure,
        x=categories,
        y=values,
        connector={"line": {"color": THEME_COLORS['border']}},
        increasing={"marker": {"color": CHART_COLORS['success']}},
        decreasing={"marker": {"color": CHART_COLORS['error']}},
        totals={"marker": {"color": CHART_COLORS['primary']}},
    ))

    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        title=title,
        height=height,
    )

    return fig
