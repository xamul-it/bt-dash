const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('equity and benchmark share log scale while drawdown stays linear', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/bt/components/FinancialChart.vue'), 'utf8');
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/import[\s\S]*?from\s+"[^"]+";/g, '')
    .replace('export default', 'module.exports =');
  const context = { module: { exports: {} }, BaselineSeries: 'equity', LineSeries: 'benchmark', HistogramSeries: 'drawdown', PriceScaleMode: { Logarithmic: 1, Normal: 0 } };
  vm.runInNewContext(script, context);
  const mainScale = {};
  const drawdownScale = {};
  const series = [];
  const points = [{ time: '2024-01-01', value: 1 }, { time: '2024-01-02', value: 10 }];
  const component = {
    equityData: points, comparisonData: points, drawdownData: [{ time: '2024-01-02', value: -.2 }],
    height: 320, formatTime: value => value,
    chart: {
      addSeries(type, options, pane = 0) {
        const scale = pane === 1 ? drawdownScale : mainScale;
        const item = { type, scale, setData(data) { this.data = data; }, priceScale: () => ({ applyOptions: options => Object.assign(scale, options) }) };
        series.push(item);
        return item;
      },
      panes: () => [null, { setHeight() {} }],
      subscribeCrosshairMove() {},
    },
  };
  context.module.exports.methods.renderEquityChart.call(component);
  assert.equal(series[0].scale.mode, 1);
  assert.equal(series[1].scale.mode, 1);
  assert.equal(series[2].scale.mode, 0);
  assert.equal(series[0].data, points);
  assert.equal(series[2].data[0].value, -.2);
});
