import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { chartGeometry, LineChart } from './LineChart';

describe('chartGeometry', () => {
  it('maps points into the 300-wide viewBox with padding', () => {
    const g = chartGeometry([{ x: 0, y: 10 }, { x: 10, y: 20 }], 120);
    expect(g.coords).toEqual([{ x: 8, y: 112 }, { x: 292, y: 8 }]);
    expect(g.band).toBeUndefined();
  });
  it('includes a target band in the vertical scale', () => {
    const g = chartGeometry([{ x: 0, y: 10 }, { x: 10, y: 20 }], 120, { min: 12, max: 18 });
    expect(g.band).toEqual({ y: 28.8, height: 62.4 });
  });
  it('centres a single point', () => {
    expect(chartGeometry([{ x: 5, y: 7 }], 120).coords).toEqual([{ x: 150, y: 60 }]);
  });
});

describe('LineChart', () => {
  it('draws a labelled line with a dot per point', () => {
    const { container } = render(<LineChart label="Weight chart" points={[{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 4 }]} />);
    expect(screen.getByRole('img', { name: 'Weight chart' })).toBeInTheDocument();
    expect(container.querySelectorAll('circle')).toHaveLength(3);
    expect(container.querySelector('polyline')).not.toBeNull();
  });
  it('shows the empty text without points', () => {
    render(<LineChart label="Weight chart" points={[]} emptyText="No weights yet" />);
    expect(screen.getByText('No weights yet')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });
});
