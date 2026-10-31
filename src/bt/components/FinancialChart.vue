<template>
  <div class="financial-chart">
    <div class="financial-chart__legend" aria-live="polite">
      <template v-if="mode === 'market'">
        <strong>{{ legend.date || "OHLCV" }}</strong>
        <span>O {{ formatPrice(legend.open) }}</span>
        <span>H {{ formatPrice(legend.high) }}</span>
        <span>L {{ formatPrice(legend.low) }}</span>
        <span>C {{ formatPrice(legend.close) }}</span>
        <span>Vol {{ formatVolume(legend.volume) }}</span>
      </template>
      <template v-else>
        <strong>{{ legend.date || "Performance" }}</strong>
        <span>Strategia {{ formatMultiple(legend.value) }}</span>
        <span v-if="comparisonPoints.length">
          Benchmark {{ formatMultiple(legend.comparison) }}
        </span>
        <span>Drawdown {{ formatPercent(legend.drawdown) }}</span>
      </template>
    </div>

    <div class="financial-chart__stage">
      <div
        ref="container"
        class="financial-chart__canvas"
        :style="{ height: `${height}px` }"
        role="img"
        :aria-label="ariaLabel"
      />
      <div v-if="!hasData" class="financial-chart__empty">
        Nessun dato disponibile per il grafico.
      </div>
    </div>

    <div class="financial-chart__credit">
      Grafici finanziari di
      <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">
        TradingView
      </a>
    </div>
  </div>
</template>

<script>
import { markRaw } from "vue";
import {
  BaselineSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  PriceScaleMode,
  createChart,
  createSeriesMarkers,
} from "lightweight-charts";

const DATE_FIELDS = ["date", "timestamp", "datetime", "index", "__index_level_0__"];

function fieldName(row, names) {
  const accepted = names.map((name) => name.toLowerCase());
  return Object.keys(row || {}).find((key) => accepted.includes(key.toLowerCase()));
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function chartTime(value, daily = true) {
  if (value == null || value === "") return null;
  const text = String(value);
  if (daily) {
    const match = text.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  const milliseconds = Date.parse(text);
  return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1000) : null;
}

function sortAndDedupe(rows) {
  const byTime = new Map();
  rows.forEach((row) => byTime.set(row.time, row));
  return [...byTime.values()].sort((left, right) =>
    left.time < right.time ? -1 : left.time > right.time ? 1 : 0,
  );
}

export default {
  name: "FinancialChart",
  props: {
    mode: { type: String, default: "equity" },
    points: { type: Array, default: () => [] },
    comparisonPoints: { type: Array, default: () => [] },
    drawdownPoints: { type: Array, default: () => [] },
    bars: { type: Array, default: () => [] },
    markers: { type: Array, default: () => [] },
    timeframe: { type: String, default: "daily" },
    height: { type: Number, default: 340 },
    ariaLabel: { type: String, default: "Grafico finanziario interattivo" },
  },
  data() {
    return {
      chart: null,
      resizeObserver: null,
      legend: {},
    };
  },
  computed: {
    hasData() {
      return this.mode === "market" ? this.marketData.length > 0 : this.equityData.length > 0;
    },
    marketData() {
      const first = this.bars[0] || {};
      const date = fieldName(first, DATE_FIELDS);
      const open = fieldName(first, ["open"]);
      const high = fieldName(first, ["high"]);
      const low = fieldName(first, ["low"]);
      const close = fieldName(first, ["close"]);
      const volume = fieldName(first, ["volume"]);
      if (!date || !open || !high || !low || !close) return [];

      return sortAndDedupe(
        this.bars
          .map((row) => ({
            time: chartTime(row[date], this.timeframe === "daily"),
            open: finite(row[open]),
            high: finite(row[high]),
            low: finite(row[low]),
            close: finite(row[close]),
            volume: volume ? finite(row[volume]) : null,
          }))
          .filter(
            (row) =>
              row.time != null &&
              row.open != null &&
              row.high != null &&
              row.low != null &&
              row.close != null,
          ),
      );
    },
    equityData() {
      return this.normalizedPoints(this.points);
    },
    comparisonData() {
      return this.normalizedPoints(this.comparisonPoints);
    },
    drawdownData() {
      if (this.drawdownPoints.length) return this.normalizedPoints(this.drawdownPoints);
      let peak = Number.NEGATIVE_INFINITY;
      return this.equityData.map((point) => {
        peak = Math.max(peak, point.value);
        return { time: point.time, value: point.value / peak - 1 };
      });
    },
  },
  watch: {
    marketData: {
      deep: true,
      handler() {
        this.renderChart();
      },
    },
    equityData: {
      deep: true,
      handler() {
        this.renderChart();
      },
    },
    comparisonData: {
      deep: true,
      handler() {
        this.renderChart();
      },
    },
    drawdownData: {
      deep: true,
      handler() {
        this.renderChart();
      },
    },
    mode() {
      this.renderChart();
    },
    timeframe() {
      this.renderChart();
    },
  },
  mounted() {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.$refs.container);
    this.scheduleRender();
  },
  beforeUnmount() {
    this.resizeObserver?.disconnect();
    this.destroyChart();
  },
  methods: {
    refresh() {
      this.renderChart();
    },
    scheduleRender() {
      this.$nextTick(() => {
        window.requestAnimationFrame(() => {
          if (this.$refs.container?.clientWidth > 0) this.renderChart();
        });
      });
    },
    normalizedPoints(points) {
      return sortAndDedupe(
        points
          .map((point) => ({
            time: chartTime(point.date ?? point.time, true),
            value: finite(point.value),
          }))
          .filter((point) => point.time != null && point.value != null),
      );
    },
    destroyChart() {
      if (this.chart) this.chart.remove();
      this.chart = null;
      this.legend = {};
    },
    renderChart() {
      if (!this.$refs.container) return;
      this.destroyChart();
      if (!this.hasData || this.$refs.container.clientWidth <= 0) return;

      const container = this.$refs.container;
      this.chart = markRaw(createChart(container, {
        width: Math.max(1, container.clientWidth),
        height: this.height,
        layout: {
          background: { type: ColorType.Solid, color: "#ffffff" },
          textColor: "#475569",
          attributionLogo: true,
        },
        grid: {
          vertLines: { color: "#eef2f7" },
          horzLines: { color: "#eef2f7" },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: "#cbd5e1" },
        timeScale: {
          borderColor: "#cbd5e1",
          timeVisible: this.mode === "market" && this.timeframe !== "daily",
          secondsVisible: false,
          rightOffset: 2,
          barSpacing: this.mode === "market" ? 8 : 5,
        },
        localization: { locale: "it-IT" },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
        handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      }));

      if (this.mode === "market") this.renderMarketChart();
      else this.renderEquityChart();

      this.chart.timeScale().fitContent();
      window.requestAnimationFrame(() => this.resize());
    },
    renderMarketChart() {
      const candleSeries = this.chart.addSeries(CandlestickSeries, {
        upColor: "#16a34a",
        downColor: "#dc2626",
        borderUpColor: "#16a34a",
        borderDownColor: "#dc2626",
        wickUpColor: "#15803d",
        wickDownColor: "#b91c1c",
        priceLineVisible: true,
      });
      candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.28 } });
      candleSeries.setData(this.marketData.map(({ volume, ...bar }) => bar));

      const volumeSeries = this.chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
      volumeSeries.setData(
        this.marketData
          .filter((bar) => bar.volume != null)
          .map((bar) => ({
            time: bar.time,
            value: bar.volume,
            color: bar.close >= bar.open ? "rgba(22, 163, 74, .45)" : "rgba(220, 38, 38, .45)",
          })),
      );

      const markerRows = this.markers
        .map((marker) => ({ ...marker, time: chartTime(marker.time ?? marker.date, this.timeframe === "daily") }))
        .filter((marker) => marker.time != null);
      if (markerRows.length) createSeriesMarkers(candleSeries, markerRows);

      const last = this.marketData[this.marketData.length - 1];
      this.legend = { ...last, date: this.formatTime(last.time) };
      this.chart.subscribeCrosshairMove((param) => {
        const candle = param.seriesData.get(candleSeries);
        const volume = param.seriesData.get(volumeSeries);
        if (!candle) return;
        this.legend = {
          ...candle,
          volume: volume?.value,
          date: this.formatTime(param.time),
        };
      });
    },
    renderEquityChart() {
      const strategySeries = this.chart.addSeries(BaselineSeries, {
        baseValue: { type: "price", price: 1 },
        topLineColor: "#2563eb",
        topFillColor1: "rgba(37, 99, 235, .28)",
        topFillColor2: "rgba(37, 99, 235, .04)",
        bottomLineColor: "#dc2626",
        bottomFillColor1: "rgba(220, 38, 38, .04)",
        bottomFillColor2: "rgba(220, 38, 38, .22)",
        lineWidth: 2,
        priceFormat: { type: "price", precision: 3, minMove: 0.001 },
      });
      strategySeries.setData(this.equityData);
      strategySeries.priceScale().applyOptions({ mode: PriceScaleMode.Logarithmic });

      let comparisonSeries = null;
      if (this.comparisonData.length) {
        comparisonSeries = this.chart.addSeries(LineSeries, {
          color: "#64748b",
          lineWidth: 2,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          priceFormat: { type: "price", precision: 3, minMove: 0.001 },
        });
        comparisonSeries.setData(this.comparisonData);
      }

      const drawdownSeries = this.chart.addSeries(
        HistogramSeries,
        {
          color: "rgba(220, 38, 38, .55)",
          base: 0,
          priceLineVisible: false,
          lastValueVisible: true,
          priceFormat: {
            type: "custom",
            minMove: 0.001,
            formatter: (value) => `${(value * 100).toFixed(1)}%`,
          },
        },
        1,
      );
      drawdownSeries.setData(this.drawdownData);
      drawdownSeries.priceScale().applyOptions({ mode: PriceScaleMode.Normal });
      this.chart.panes()[1]?.setHeight(Math.max(70, Math.round(this.height * 0.22)));

      const last = this.equityData[this.equityData.length - 1];
      const lastDrawdown = this.drawdownData[this.drawdownData.length - 1];
      this.legend = {
        date: this.formatTime(last.time),
        value: last.value,
        drawdown: lastDrawdown?.value,
      };
      this.chart.subscribeCrosshairMove((param) => {
        const strategy = param.seriesData.get(strategySeries);
        if (!strategy) return;
        const comparison = comparisonSeries ? param.seriesData.get(comparisonSeries) : null;
        const drawdown = param.seriesData.get(drawdownSeries);
        this.legend = {
          date: this.formatTime(param.time),
          value: strategy.value,
          comparison: comparison?.value,
          drawdown: drawdown?.value,
        };
      });
    },
    resize() {
      if (!this.$refs.container) return;
      if (!this.chart) {
        if (this.hasData && this.$refs.container.clientWidth > 0) this.renderChart();
        return;
      }
      const width = this.$refs.container.clientWidth;
      if (width > 0) this.chart.applyOptions({ width, height: this.height });
    },
    formatTime(time) {
      if (time == null) return "";
      if (typeof time === "object" && time.year && time.month && time.day) {
        return `${String(time.day).padStart(2, "0")}/${String(time.month).padStart(2, "0")}/${time.year}`;
      }
      if (typeof time === "string") {
        const [year, month, day] = time.split("-");
        return `${day}/${month}/${year}`;
      }
      const milliseconds = Number(time) * 1000;
      return new Intl.DateTimeFormat("it-IT", {
        dateStyle: "short",
        timeStyle: this.timeframe === "daily" ? undefined : "short",
      }).format(new Date(milliseconds));
    },
    formatPrice(value) {
      return value == null
        ? "—"
        : Number(value).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    },
    formatVolume(value) {
      return value == null
        ? "—"
        : new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 1 }).format(value);
    },
    formatMultiple(value) {
      return value == null
        ? "—"
        : `${Number(value).toLocaleString("it-IT", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}×`;
    },
    formatPercent(value) {
      return value == null
        ? "—"
        : `${(Number(value) * 100).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    },
  },
};
</script>

<style scoped>
.financial-chart {
  width: 100%;
  min-width: 0;
}

.financial-chart__legend {
  display: flex;
  min-height: 30px;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 14px;
  padding: 4px 8px;
  color: #475569;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.financial-chart__legend strong {
  color: #0f172a;
}

.financial-chart__stage {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.financial-chart__canvas {
  width: 100%;
}

.financial-chart__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #64748b;
}

.financial-chart__credit {
  padding: 3px 4px 0;
  color: #94a3b8;
  font-size: 10px;
  text-align: right;
}

.financial-chart__credit a {
  color: inherit;
}
</style>
