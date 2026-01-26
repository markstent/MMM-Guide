"""Budget optimization for Marketing Mix Modeling."""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from scipy.optimize import minimize, LinearConstraint


def calculate_marginal_roi_loglog(
    current_spend: float,
    elasticity: float,
    avg_sales: float,
    avg_spend: float,
) -> float:
    """
    Calculate marginal ROI for a log-log model.

    In a log-log model: log(y) = a + b*log(x)
    dy/dx = b * y / x
    Marginal ROI = dy/dx = elasticity * (y/x)

    Args:
        current_spend: Current spend level
        elasticity: Channel elasticity
        avg_sales: Average sales
        avg_spend: Average channel spend

    Returns:
        Marginal ROI at current spend level
    """
    if current_spend <= 0:
        return 0

    # Using average values as reference point
    return elasticity * (avg_sales / current_spend)


def optimize_budget_marginal_roi(
    total_budget: float,
    channels: List[str],
    elasticities: Dict[str, float],
    current_spend: Dict[str, float],
    avg_sales: float,
    constraints: Optional[Dict[str, Tuple[float, float]]] = None,
) -> Dict[str, float]:
    """
    Optimize budget allocation to equalize marginal ROI across channels.

    The optimal allocation equalizes marginal ROI across all channels
    (at the optimum, reallocating $1 from any channel to any other
    would not increase total returns).

    Args:
        total_budget: Total budget to allocate
        channels: List of channel names
        elasticities: Dictionary of elasticities per channel
        current_spend: Dictionary of current spend per channel
        avg_sales: Average sales
        constraints: Optional min/max constraints as (min_pct, max_pct) tuples

    Returns:
        Dictionary of optimized spend per channel
    """
    n_channels = len(channels)
    constraints = constraints or {}

    # Set up default constraints
    default_min = 0.05  # 5% minimum
    default_max = 0.80  # 80% maximum

    min_bounds = []
    max_bounds = []
    for ch in channels:
        min_pct, max_pct = constraints.get(ch, (default_min, default_max))
        min_bounds.append(min_pct * total_budget)
        max_bounds.append(max_pct * total_budget)

    # Objective: maximize total effect
    # For log-log model: effect ~ elasticity * log(spend)
    def objective(x):
        total_effect = 0
        for i, ch in enumerate(channels):
            if x[i] > 0:
                total_effect += elasticities[ch] * np.log(x[i])
        return -total_effect  # Negative for minimization

    # Gradient for faster optimization
    def gradient(x):
        grad = np.zeros(n_channels)
        for i, ch in enumerate(channels):
            if x[i] > 0:
                grad[i] = -elasticities[ch] / x[i]
        return grad

    # Constraints
    # 1. Budget constraint: sum(x) = total_budget
    budget_constraint = LinearConstraint(
        np.ones(n_channels),
        lb=total_budget,
        ub=total_budget,
    )

    # 2. Bounds for each channel
    bounds = list(zip(min_bounds, max_bounds))

    # Initial guess: proportional to current spend or equal
    total_current = sum(current_spend.values())
    if total_current > 0:
        x0 = np.array([
            current_spend.get(ch, total_budget / n_channels) / total_current * total_budget
            for ch in channels
        ])
    else:
        x0 = np.full(n_channels, total_budget / n_channels)

    # Clip to bounds
    x0 = np.clip(x0, min_bounds, max_bounds)

    # Normalize to meet budget constraint
    x0 = x0 / x0.sum() * total_budget

    # Optimize
    result = minimize(
        objective,
        x0,
        method='SLSQP',
        jac=gradient,
        bounds=bounds,
        constraints={'type': 'eq', 'fun': lambda x: x.sum() - total_budget},
        options={'maxiter': 1000, 'ftol': 1e-10},
    )

    # Return optimal allocation
    optimal_spend = {ch: max(0, result.x[i]) for i, ch in enumerate(channels)}

    # Ensure budget constraint is exactly met
    total_allocated = sum(optimal_spend.values())
    if total_allocated > 0:
        for ch in channels:
            optimal_spend[ch] = optimal_spend[ch] / total_allocated * total_budget

    return optimal_spend


def calculate_expected_lift(
    current_spend: Dict[str, float],
    optimal_spend: Dict[str, float],
    elasticities: Dict[str, float],
    current_sales: float,
) -> Dict[str, float]:
    """
    Calculate expected lift from budget reallocation.

    Args:
        current_spend: Current spend allocation
        optimal_spend: Optimized spend allocation
        elasticities: Channel elasticities
        current_sales: Current total sales

    Returns:
        Dictionary with lift metrics
    """
    # Calculate percentage change in sales using elasticity approximation
    # %change in sales ~ sum(elasticity_i * %change in spend_i)
    total_pct_change = 0

    for channel in elasticities:
        curr = current_spend.get(channel, 0)
        opt = optimal_spend.get(channel, 0)

        if curr > 0:
            pct_change_spend = (opt - curr) / curr
            pct_change_sales = elasticities[channel] * pct_change_spend
            total_pct_change += pct_change_sales

    expected_sales = current_sales * (1 + total_pct_change)
    lift = expected_sales - current_sales

    return {
        'current_sales': current_sales,
        'expected_sales': expected_sales,
        'lift': lift,
        'lift_pct': total_pct_change * 100,
    }


def create_scenario(
    name: str,
    spend_allocation: Dict[str, float],
    elasticities: Dict[str, float],
    baseline_sales: float,
) -> Dict:
    """
    Create a scenario for comparison.

    Args:
        name: Scenario name
        spend_allocation: Spend per channel
        elasticities: Channel elasticities
        baseline_sales: Baseline sales level

    Returns:
        Scenario dictionary
    """
    total_spend = sum(spend_allocation.values())

    # Calculate projected sales using log-log relationship
    # y = baseline * prod((spend_i / avg_spend_i)^elasticity_i)
    projected_multiplier = 1.0
    for channel, spend in spend_allocation.items():
        if spend > 0 and channel in elasticities:
            # Simplified: assume avg_spend equals current allocation
            projected_multiplier *= 1 + elasticities[channel] * 0.1  # Rough approximation

    projected_sales = baseline_sales * projected_multiplier

    return {
        'name': name,
        'spend_allocation': spend_allocation,
        'total_spend': total_spend,
        'projected_sales': projected_sales,
        'roi': projected_sales / total_spend if total_spend > 0 else 0,
    }


def compare_scenarios(scenarios: List[Dict]) -> pd.DataFrame:
    """
    Compare multiple scenarios.

    Args:
        scenarios: List of scenario dictionaries

    Returns:
        DataFrame with scenario comparison
    """
    data = []
    for scenario in scenarios:
        row = {
            'scenario': scenario['name'],
            'total_spend': scenario['total_spend'],
            'projected_sales': scenario['projected_sales'],
            'roi': scenario['roi'],
        }
        # Add individual channel allocations
        for channel, spend in scenario['spend_allocation'].items():
            row[f'spend_{channel}'] = spend
        data.append(row)

    return pd.DataFrame(data)
