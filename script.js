// Beam Shear and Bending Moment Diagram Tool
// This script handles dynamic UI rows, gathers input data,
// performs a simple finite element analysis for Euler–Bernoulli beams,
// and plots shear force and bending moment diagrams using Plotly.

// Global variables to hold the latest computed results and animation state
// These will be populated by computeBeam() and used by animateDiagrams().
window.latestResult = null;
window.animationInterval = null;

// On page load, insert one empty row for each load type
document.addEventListener('DOMContentLoaded', () => {
  addPointLoadRow();
  addUdlRow();
  addMomentRow();

  // Initialize sliders for all numeric inputs and set up beam plot
  initializeSliders();
  updateBeamPlot();

  // Update beam plot when support types change
  const leftSel = document.getElementById('leftSupport');
  const rightSel = document.getElementById('rightSupport');
  if (leftSel) leftSel.addEventListener('change', updateBeamPlot);
  if (rightSel) rightSel.addEventListener('change', updateBeamPlot);
  // Attach event listeners to additional support table (delegation)
  const supportTable = document.getElementById('supportTable');
  if (supportTable) {
    supportTable.addEventListener('input', () => {
      // On any change within support table, redraw beam
      updateBeamPlot();
    });
    supportTable.addEventListener('change', () => {
      updateBeamPlot();
    });
  }
});

// Add a new support row with optional initial values
function addSupportRow(pos = '', type = 'pinned') {
  const table = document.getElementById('supportTable').getElementsByTagName('tbody')[0];
  const row = table.insertRow();
  const posCell = row.insertCell();
  const typeCell = row.insertCell();
  const removeCell = row.insertCell();

  const posInput = document.createElement('input');
  posInput.type = 'number';
  posInput.value = pos;
  posInput.step = '0.1';
  posInput.className = 'support-position';
  posCell.appendChild(posInput);

  const typeSelect = document.createElement('select');
  // Allow various support types: pinned (roller), fixed and free
  const types = ['pinned', 'roller', 'fixed', 'free'];
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    // Capitalize for display; show 'Pinned' and 'Roller' distinctly
    opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    if (t === type) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeSelect.className = 'support-type';
  typeCell.appendChild(typeSelect);

  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove';
  removeBtn.onclick = () => {
    row.remove();
    updateBeamPlot();
  };
  removeCell.appendChild(removeBtn);

  // Attach slider if needed (for numeric inputs)
  initializeSliders();
  // Update beam plot when adding new support
  updateBeamPlot();
}

// Add a new point load row with optional initial values
function addPointLoadRow(mag = '', pos = '') {
  const table = document.getElementById('pointLoadTable').getElementsByTagName('tbody')[0];
  const row = table.insertRow();
  const magCell = row.insertCell();
  const posCell = row.insertCell();
  const removeCell = row.insertCell();

  const magInput = document.createElement('input');
  magInput.type = 'number';
  magInput.value = mag;
  magInput.step = '0.1';
  magInput.className = 'point-magnitude';
  magCell.appendChild(magInput);

  const posInput = document.createElement('input');
  posInput.type = 'number';
  posInput.value = pos;
  posInput.step = '0.1';
  posInput.className = 'point-position';
  posCell.appendChild(posInput);

  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove';
  removeBtn.onclick = () => row.remove();
  removeCell.appendChild(removeBtn);

  // After adding a new point load row, ensure sliders are attached
  // and redraw the beam plot to reflect potential default ranges.
  initializeSliders();
  updateBeamPlot();
}

// Add a new uniform distributed load (UDL) row with optional initial values
function addUdlRow(start = '', end = '', q = '') {
  const table = document.getElementById('udlTable').getElementsByTagName('tbody')[0];
  const row = table.insertRow();
  const startCell = row.insertCell();
  const endCell = row.insertCell();
  const qCell = row.insertCell();
  const removeCell = row.insertCell();

  const startInput = document.createElement('input');
  startInput.type = 'number';
  startInput.value = start;
  startInput.step = '0.1';
  startInput.className = 'udl-start';
  startCell.appendChild(startInput);

  const endInput = document.createElement('input');
  endInput.type = 'number';
  endInput.value = end;
  endInput.step = '0.1';
  endInput.className = 'udl-end';
  endCell.appendChild(endInput);

  const qInput = document.createElement('input');
  qInput.type = 'number';
  qInput.value = q;
  qInput.step = '0.1';
  qInput.className = 'udl-q';
  qCell.appendChild(qInput);

  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove';
  removeBtn.onclick = () => row.remove();
  removeCell.appendChild(removeBtn);

  // Attach sliders for the newly added UDL inputs and update the beam plot
  initializeSliders();
  updateBeamPlot();
}

// Add a new point moment row with optional initial values
function addMomentRow(mag = '', pos = '') {
  const table = document.getElementById('momentTable').getElementsByTagName('tbody')[0];
  const row = table.insertRow();
  const magCell = row.insertCell();
  const posCell = row.insertCell();
  const removeCell = row.insertCell();

  const magInput = document.createElement('input');
  magInput.type = 'number';
  magInput.value = mag;
  magInput.step = '0.1';
  magInput.className = 'moment-magnitude';
  magCell.appendChild(magInput);

  const posInput = document.createElement('input');
  posInput.type = 'number';
  posInput.value = pos;
  posInput.step = '0.1';
  posInput.className = 'moment-position';
  posCell.appendChild(posInput);

  const removeBtn = document.createElement('button');
  removeBtn.textContent = 'Remove';
  removeBtn.onclick = () => row.remove();
  removeCell.appendChild(removeBtn);

  // Ensure sliders are attached for newly added moment inputs and update the beam plot
  initializeSliders();
  updateBeamPlot();
}

// Initialize range sliders for all numeric inputs. Each slider allows
// interactive adjustment of the corresponding value within ±50% of its
// current magnitude. For empty inputs (or zero), the slider defaults to
// the range [0, 20]. Sliders update the input value and redraw the
// beam/load diagram on change.
function initializeSliders() {
  const numberInputs = document.querySelectorAll('input[type="number"]');
  numberInputs.forEach(input => {
    // Avoid attaching multiple sliders
    if (input.dataset.sliderAttached === 'true') return;
    input.dataset.sliderAttached = 'true';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.step = input.step || '0.1';

    // Helper to update slider range based on input value
    function setSliderRange() {
      const val = parseFloat(input.value);
      if (!isNaN(val) && val !== 0) {
        // Compute ±50% of current value
        const minVal = Math.min(val * 0.5, val * 1.5);
        const maxVal = Math.max(val * 0.5, val * 1.5);
        slider.min = minVal;
        slider.max = maxVal;
        // Clamp slider value to new range
        let sVal = parseFloat(slider.value);
        if (isNaN(sVal)) sVal = val;
        if (sVal < slider.min) sVal = slider.min;
        if (sVal > slider.max) sVal = slider.max;
        slider.value = sVal;
      } else {
        // Default range for undefined/zero values
        slider.min = 0;
        slider.max = 20;
        const currentVal = parseFloat(input.value);
        slider.value = !isNaN(currentVal) ? currentVal : 0;
      }
    }
    // Initialize slider range and value
    setSliderRange();
    // When slider value changes, update the input and beam plot
    slider.addEventListener('input', () => {
      input.value = slider.value;
      // Changing slider does not immediately change its own range; range update occurs on input change
      updateBeamPlot();
    });
    // When the input value changes (by typing), adjust slider range and update beam plot
    input.addEventListener('input', () => {
      setSliderRange();
      slider.value = input.value || 0;
      updateBeamPlot();
    });
    // Insert slider right after the input element
    input.parentNode.insertBefore(slider, input.nextSibling);
  });
}

// Redraw the beam and load distribution diagram based on current inputs.
function updateBeamPlot() {
  // Parse beam length
  const LVal = parseFloat(document.getElementById('beamLength').value);
  if (isNaN(LVal) || LVal <= 0) {
    // Clear plot if length invalid
    Plotly.purge('beamPlot');
    return;
  }
  const L = LVal;
  // Parse loads similar to computeBeam
  // Point loads
  const pointRows = document.getElementById('pointLoadTable').getElementsByTagName('tbody')[0].rows;
  const pointLoads = [];
  for (let i = 0; i < pointRows.length; i++) {
    const cells = pointRows[i].cells;
    const mag = parseFloat(cells[0].firstChild.value);
    const pos = parseFloat(cells[1].firstChild.value);
    if (!isNaN(mag) && !isNaN(pos) && pos >= 0 && pos <= L) {
      pointLoads.push({P: mag, x: pos});
    }
  }
  // UDLs
  const udlRows = document.getElementById('udlTable').getElementsByTagName('tbody')[0].rows;
  const udls = [];
  for (let i = 0; i < udlRows.length; i++) {
    const cells = udlRows[i].cells;
    if (cells.length < 3) continue;
    const start = parseFloat(cells[0].firstChild.value);
    const end = parseFloat(cells[1].firstChild.value);
    const q = parseFloat(cells[2].firstChild.value);
    if (!isNaN(start) && !isNaN(end) && !isNaN(q)) {
      const a = Math.min(start, end);
      const b = Math.max(start, end);
      if (b > a && a >= 0 && b <= L) {
        udls.push({a: a, b: b, q: q});
      }
    }
  }
  // Moments
  const momentRows = document.getElementById('momentTable').getElementsByTagName('tbody')[0].rows;
  const moments = [];
  for (let i = 0; i < momentRows.length; i++) {
    const cells = momentRows[i].cells;
    if (cells.length < 2) continue;
    const mag = parseFloat(cells[0].firstChild.value);
    const pos = parseFloat(cells[1].firstChild.value);
    if (!isNaN(mag) && !isNaN(pos) && pos >= 0 && pos <= L) {
      moments.push({M: mag, x: pos});
    }
  }

  // Additional supports
  const supportList = [];
  const supportRows = document.getElementById('supportTable').getElementsByTagName('tbody')[0].rows;
  for (let i = 0; i < supportRows.length; i++) {
    const cells = supportRows[i].cells;
    if (cells.length < 2) continue;
    const pos = parseFloat(cells[0].firstChild.value);
    const type = cells[1].firstChild.value;
    if (!isNaN(pos) && pos >= 0 && pos <= L) {
      supportList.push({type: type, x: pos});
    }
  }
  // Determine scale for visual representation
  let maxVal = 0;
  pointLoads.forEach(pl => { maxVal = Math.max(maxVal, Math.abs(pl.P)); });
  udls.forEach(ud => { maxVal = Math.max(maxVal, Math.abs(ud.q)); });
  moments.forEach(mo => { maxVal = Math.max(maxVal, Math.abs(mo.M)); });
  if (maxVal === 0) maxVal = 1;
  // Build base beam trace
  const beamTrace = {
    x: [0, L],
    y: [0, 0],
    mode: 'lines',
    line: { color: '#000000', width: 2 },
    showlegend: false
  };
  const shapes = [];
  const annotations = [];
  // UDL rectangles
  udls.forEach(ud => {
    const height = -ud.q / maxVal; // negative draws downward when q negative
    shapes.push({
      type: 'rect',
      xref: 'x',
      yref: 'y',
      x0: ud.a,
      x1: ud.b,
      y0: 0,
      y1: height,
      line: { color: 'rgba(0, 0, 255, 0.8)', width: 1 },
      fillcolor: 'rgba(173, 216, 230, 0.5)'
    });
    // Label for UDL
    annotations.push({
      x: (ud.a + ud.b) / 2,
      y: height / 2,
      text: `q=${ud.q}`,
      showarrow: false,
      font: { size: 10, color: '#003399' }
    });
  });
  // Point loads arrows
  pointLoads.forEach(pl => {
    const arrowLength = -pl.P / maxVal; // downward if P negative
    annotations.push({
      x: pl.x,
      y: 0,
      ax: pl.x,
      ay: arrowLength,
      xref: 'x',
      yref: 'y',
      axref: 'x',
      ayref: 'y',
      text: '',
      showarrow: true,
      arrowhead: 3,
      arrowsize: 1,
      arrowwidth: 1.5,
      arrowcolor: '#d62728'
    });
    // Label for point load
    annotations.push({
      x: pl.x,
      y: arrowLength - 0.05 * Math.sign(arrowLength),
      text: `${pl.P}`,
      showarrow: false,
      font: { size: 10, color: '#d62728' },
      xanchor: 'center'
    });
  });
  // Point moments representation as circular arrows (approximated by text)
  moments.forEach(mo => {
    // Represent moment as curved arrow using annotation with text and slight offset
    annotations.push({
      x: mo.x,
      y: 0.3,
      text: `M=${mo.M}`,
      showarrow: false,
      font: { size: 10, color: '#9467bd' },
      xanchor: 'center'
    });
    // Draw a small circular arrow using a path shape
    const radius = 0.2;
    const angleStart = 0;
    const angleEnd = 2 * Math.PI * (mo.M >= 0 ? 1 : -1) * 0.25; // quarter turn for sign
    const path = describeArc(mo.x, 0, radius, angleStart, angleEnd);
    shapes.push({
      type: 'path',
      path: path,
      line: { color: '#9467bd', width: 1.5 }
    });
  });
  const data = [beamTrace];
  // Support shapes: depict left and right support types
  const leftSupport = document.getElementById('leftSupport').value;
  const rightSupport = document.getElementById('rightSupport').value;
  // Choose a width proportional to beam length for support symbols
  const suppWidth = 0.05 * L; // 5% of beam length
  const suppHeight = 0.25;    // Height of support symbol below baseline
  // Add left support symbol based on type (pinned, roller, fixed, free)
  {
    const baseStart = 0;
    const baseEnd = Math.min(suppWidth, L);
    // Pinned: downward triangle with a hinge circle
    if (leftSupport === 'pinned') {
      const apexX = (baseStart + baseEnd) / 2;
      const triPath = `M ${baseStart} 0 L ${baseEnd} 0 L ${apexX} ${-suppHeight} Z`;
      shapes.push({
        type: 'path',
        path: triPath,
        fillcolor: 'rgba(100,100,100,0.6)',
        line: { color: '#444444' }
      });
      // hinge circle centred at the apex point on the baseline
      const radius = suppWidth / 4;
      shapes.push({
        type: 'circle',
        xref: 'x', yref: 'y',
        x0: apexX - radius,
        x1: apexX + radius,
        y0: -radius,
        y1: radius,
        fillcolor: 'rgba(100,100,100,0.6)',
        line: { color: '#444444' }
      });
    }
    // Roller: triangle with rollers (small circles) beneath
    else if (leftSupport === 'roller') {
      const apexX = (baseStart + baseEnd) / 2;
      const triPath = `M ${baseStart} 0 L ${baseEnd} 0 L ${apexX} ${-suppHeight} Z`;
      shapes.push({
        type: 'path',
        path: triPath,
        fillcolor: 'rgba(100,100,100,0.6)',
        line: { color: '#444444' }
      });
      // draw small roller circles along the base
      const baseW = baseEnd - baseStart;
      const rRoll = suppWidth / 8;
      // centres of rollers evenly spaced along base
      const positions = [
        baseStart + baseW * 0.25,
        baseStart + baseW * 0.5,
        baseStart + baseW * 0.75
      ];
      const yCenter = -suppHeight - rRoll;
      positions.forEach(px => {
        shapes.push({
          type: 'circle',
          xref: 'x', yref: 'y',
          x0: px - rRoll,
          x1: px + rRoll,
          y0: yCenter - rRoll,
          y1: yCenter + rRoll,
          fillcolor: 'rgba(200,200,200,1)',
          line: { color: '#444444' }
        });
      });
    }
    // Fixed: rectangle with cross-hatching
    else if (leftSupport === 'fixed') {
      shapes.push({
        type: 'rect',
        xref: 'x', yref: 'y',
        x0: baseStart,
        x1: baseEnd,
        y0: -suppHeight,
        y1: 0,
        fillcolor: 'rgba(150,150,150,0.8)',
        line: { color: '#444444' }
      });
      // cross-hatching lines inside the rectangle
      shapes.push({
        type: 'line',
        xref: 'x', yref: 'y',
        x0: baseStart,
        y0: -suppHeight,
        x1: baseEnd,
        y1: 0,
        line: { color: '#444444', width: 1 }
      });
      shapes.push({
        type: 'line',
        xref: 'x', yref: 'y',
        x0: baseStart,
        y0: 0,
        x1: baseEnd,
        y1: -suppHeight,
        line: { color: '#444444', width: 1 }
      });
    }
    // Free: open circle at beam end
    else if (leftSupport === 'free') {
      const radius = suppWidth / 4;
      shapes.push({
        type: 'circle',
        xref: 'x', yref: 'y',
        x0: -radius,
        x1: radius,
        y0: -radius,
        y1: radius,
        fillcolor: 'rgba(255,255,255,0)',
        line: { color: '#444444' }
      });
    }
  }
  // Add right support symbol based on type (pinned, roller, fixed, free)
  {
    const baseEnd = L;
    const baseStart = Math.max(L - suppWidth, 0);
    // Pinned: triangle + hinge
    if (rightSupport === 'pinned') {
      const apexX = (baseStart + baseEnd) / 2;
      const triPath = `M ${baseStart} 0 L ${baseEnd} 0 L ${apexX} ${-suppHeight} Z`;
      shapes.push({
        type: 'path',
        path: triPath,
        fillcolor: 'rgba(100,100,100,0.6)',
        line: { color: '#444444' }
      });
      const radius = suppWidth / 4;
      shapes.push({
        type: 'circle',
        xref: 'x', yref: 'y',
        x0: apexX - radius,
        x1: apexX + radius,
        y0: -radius,
        y1: radius,
        fillcolor: 'rgba(100,100,100,0.6)',
        line: { color: '#444444' }
      });
    }
    // Roller: triangle + rollers
    else if (rightSupport === 'roller') {
      const apexX = (baseStart + baseEnd) / 2;
      const triPath = `M ${baseStart} 0 L ${baseEnd} 0 L ${apexX} ${-suppHeight} Z`;
      shapes.push({
        type: 'path',
        path: triPath,
        fillcolor: 'rgba(100,100,100,0.6)',
        line: { color: '#444444' }
      });
      const baseW = baseEnd - baseStart;
      const rRoll = suppWidth / 8;
      const positions = [
        baseStart + baseW * 0.25,
        baseStart + baseW * 0.5,
        baseStart + baseW * 0.75
      ];
      const yCenter = -suppHeight - rRoll;
      positions.forEach(px => {
        shapes.push({
          type: 'circle',
          xref: 'x', yref: 'y',
          x0: px - rRoll,
          x1: px + rRoll,
          y0: yCenter - rRoll,
          y1: yCenter + rRoll,
          fillcolor: 'rgba(200,200,200,1)',
          line: { color: '#444444' }
        });
      });
    }
    // Fixed: rectangle with cross-hatching
    else if (rightSupport === 'fixed') {
      shapes.push({
        type: 'rect',
        xref: 'x', yref: 'y',
        x0: baseStart,
        x1: baseEnd,
        y0: -suppHeight,
        y1: 0,
        fillcolor: 'rgba(150,150,150,0.8)',
        line: { color: '#444444' }
      });
      shapes.push({
        type: 'line',
        xref: 'x', yref: 'y',
        x0: baseStart,
        y0: -suppHeight,
        x1: baseEnd,
        y1: 0,
        line: { color: '#444444', width: 1 }
      });
      shapes.push({
        type: 'line',
        xref: 'x', yref: 'y',
        x0: baseStart,
        y0: 0,
        x1: baseEnd,
        y1: -suppHeight,
        line: { color: '#444444', width: 1 }
      });
    }
    // Free: open circle
    else if (rightSupport === 'free') {
      const radius = suppWidth / 4;
      shapes.push({
        type: 'circle',
        xref: 'x', yref: 'y',
        x0: L - radius,
        x1: L + radius,
        y0: -radius,
        y1: radius,
        fillcolor: 'rgba(255,255,255,0)',
        line: { color: '#444444' }
      });
    }
  }

  // Draw additional support symbols
  supportList.forEach(supp => {
    const pos = supp.x;
    const type = supp.type;
    const baseStart = Math.max(pos - suppWidth / 2, 0);
    const baseEnd = Math.min(pos + suppWidth / 2, L);
    // Pinned: triangle + hinge
    if (type === 'pinned') {
      const triPath = `M ${baseStart} 0 L ${baseEnd} 0 L ${pos} ${-suppHeight} Z`;
      shapes.push({
        type: 'path',
        path: triPath,
        fillcolor: 'rgba(100,100,100,0.6)',
        line: { color: '#444444' }
      });
      const radius = suppWidth / 4;
      shapes.push({
        type: 'circle',
        xref: 'x', yref: 'y',
        x0: pos - radius,
        x1: pos + radius,
        y0: -radius,
        y1: radius,
        fillcolor: 'rgba(100,100,100,0.6)',
        line: { color: '#444444' }
      });
    }
    // Roller: triangle + rollers
    else if (type === 'roller') {
      const triPath = `M ${baseStart} 0 L ${baseEnd} 0 L ${pos} ${-suppHeight} Z`;
      shapes.push({
        type: 'path',
        path: triPath,
        fillcolor: 'rgba(100,100,100,0.6)',
        line: { color: '#444444' }
      });
      const baseW = baseEnd - baseStart;
      const rRoll = suppWidth / 8;
      const positions = [
        baseStart + baseW * 0.25,
        baseStart + baseW * 0.5,
        baseStart + baseW * 0.75
      ];
      const yCenter = -suppHeight - rRoll;
      positions.forEach(px => {
        shapes.push({
          type: 'circle',
          xref: 'x', yref: 'y',
          x0: px - rRoll,
          x1: px + rRoll,
          y0: yCenter - rRoll,
          y1: yCenter + rRoll,
          fillcolor: 'rgba(200,200,200,1)',
          line: { color: '#444444' }
        });
      });
    }
    // Fixed: rectangle with cross-hatching
    else if (type === 'fixed') {
      shapes.push({
        type: 'rect',
        xref: 'x', yref: 'y',
        x0: baseStart,
        x1: baseEnd,
        y0: -suppHeight,
        y1: 0,
        fillcolor: 'rgba(150,150,150,0.8)',
        line: { color: '#444444' }
      });
      shapes.push({
        type: 'line',
        xref: 'x', yref: 'y',
        x0: baseStart,
        y0: -suppHeight,
        x1: baseEnd,
        y1: 0,
        line: { color: '#444444', width: 1 }
      });
      shapes.push({
        type: 'line',
        xref: 'x', yref: 'y',
        x0: baseStart,
        y0: 0,
        x1: baseEnd,
        y1: -suppHeight,
        line: { color: '#444444', width: 1 }
      });
    }
    // Free: open circle
    else if (type === 'free') {
      const radius = suppWidth / 4;
      shapes.push({
        type: 'circle',
        xref: 'x', yref: 'y',
        x0: pos - radius,
        x1: pos + radius,
        y0: -radius,
        y1: radius,
        fillcolor: 'rgba(255,255,255,0)',
        line: { color: '#444444' }
      });
    }
  });
  // Add axis lines to emphasise horizontal (y=0) and vertical (x=0) axes
  {
    const yMin = -1.5;
    const yMax = 1.5;
    // vertical axis at x=0
    shapes.push({
      type: 'line',
      xref: 'x', yref: 'y',
      x0: 0,
      y0: yMin,
      x1: 0,
      y1: yMax,
      line: { color: '#000000', width: 2 }
    });
    // horizontal axis at y=0
    shapes.push({
      type: 'line',
      xref: 'x', yref: 'y',
      x0: 0,
      y0: 0,
      x1: L,
      y1: 0,
      line: { color: '#000000', width: 2 }
    });
  }

  // Layout definition
  const layout = {
    title: 'Beam & Load Distribution',
    xaxis: {
      title: 'Position x [m]',
      range: [0, L],
      showline: true,
      linecolor: '#000000',
      linewidth: 2,
      mirror: true,
      ticks: 'inside',
      showticklabels: true,
      zeroline: true,
      zerolinecolor: '#000000',
      zerolinewidth: 2
    },
    yaxis: {
      title: '',
      range: [-1.5, 1.5],
      showline: true,
      linecolor: '#000000',
      linewidth: 2,
      mirror: true,
      ticks: 'inside',
      showticklabels: true,
      zeroline: true,
      zerolinecolor: '#000000',
      zerolinewidth: 2
    },
    shapes: shapes,
    annotations: annotations,
    showlegend: false,
    margin: { t: 40, r: 20, b: 40, l: 40 },
    height: 300
  };
  Plotly.react('beamPlot', data, layout);
}

// Helper function to generate an SVG arc path for moment arrows
function describeArc(x, y, radius, startAngle, endAngle) {
  // Convert angles from radians to degrees
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= Math.PI ? 0 : 1;
  const sweepFlag = endAngle > startAngle ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}

function polarToCartesian(centerX, centerY, radius, angleInRadians) {
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
}

// Primary computation function triggered by the "Compute Diagrams" button
function computeBeam() {
  // Read beam length and supports
  const L = parseFloat(document.getElementById('beamLength').value);
  if (isNaN(L) || L <= 0) {
    alert('Please enter a valid beam length.');
    return;
  }
  const leftSupport = document.getElementById('leftSupport').value;
  const rightSupport = document.getElementById('rightSupport').value;

  // Read point loads
  const pointRows = document.getElementById('pointLoadTable').getElementsByTagName('tbody')[0].rows;
  const pointLoads = [];
  for (let i = 0; i < pointRows.length; i++) {
    const cells = pointRows[i].cells;
    const mag = parseFloat(cells[0].firstChild.value);
    const pos = parseFloat(cells[1].firstChild.value);
    if (!isNaN(mag) && !isNaN(pos) && pos >= 0 && pos <= L) {
      pointLoads.push({P: mag, x: pos});
    }
  }

  // Read distributed loads
  const udlRows = document.getElementById('udlTable').getElementsByTagName('tbody')[0].rows;
  const udls = [];
  for (let i = 0; i < udlRows.length; i++) {
    const cells = udlRows[i].cells;
    const start = parseFloat(cells[0].firstChild.value);
    const end = parseFloat(cells[1].firstChild.value);
    const q = parseFloat(cells[2].firstChild.value);
    if (!isNaN(start) && !isNaN(end) && !isNaN(q)) {
      const a = Math.min(start, end);
      const b = Math.max(start, end);
      if (b > a && a >= 0 && b <= L) {
        udls.push({a: a, b: b, q: q});
      }
    }
  }

  // Read point moments
  const momentRows = document.getElementById('momentTable').getElementsByTagName('tbody')[0].rows;
  const moments = [];
  for (let i = 0; i < momentRows.length; i++) {
    const cells = momentRows[i].cells;
    const mag = parseFloat(cells[0].firstChild.value);
    const pos = parseFloat(cells[1].firstChild.value);
    if (!isNaN(mag) && !isNaN(pos) && pos >= 0 && pos <= L) {
      moments.push({M: mag, x: pos});
    }
  }

  // Read additional supports from table
  const additionalSupports = [];
  const supportRows = document.getElementById('supportTable').getElementsByTagName('tbody')[0].rows;
  for (let i = 0; i < supportRows.length; i++) {
    const cells = supportRows[i].cells;
    if (cells.length < 2) continue;
    const posVal = parseFloat(cells[0].firstChild.value);
    const typeVal = cells[1].firstChild.value;
    if (!isNaN(posVal) && posVal >= 0 && posVal <= L) {
      additionalSupports.push({ x: posVal, type: typeVal });
    }
  }

  // Build node positions: include 0 and L plus all load locations and UDL bounds
  let positions = [0, L];
  pointLoads.forEach(pl => positions.push(pl.x));
  moments.forEach(mo => positions.push(mo.x));
  udls.forEach(ud => { positions.push(ud.a); positions.push(ud.b); });
  // Include support positions in node set
  additionalSupports.forEach(supp => {
    positions.push(supp.x);
  });
  // Remove duplicates and sort
  positions = Array.from(new Set(positions)).filter(pos => pos >= 0 && pos <= L);
  positions.sort((a, b) => a - b);

  const nNodes = positions.length;
  const nElem = nNodes - 1;

  // Initialize node loads and node moments arrays
  const nodeLoads = new Array(nNodes).fill(0);
  const nodeMoments = new Array(nNodes).fill(0);
  // Map point loads to nodes exactly (positions array contains those positions)
  pointLoads.forEach(pl => {
    const idx = positions.indexOf(pl.x);
    if (idx >= 0) nodeLoads[idx] += pl.P;
  });
  moments.forEach(mo => {
    const idx = positions.indexOf(mo.x);
    if (idx >= 0) nodeMoments[idx] += mo.M;
  });

  // Compute element distributed loads: constant q on each element
  const qElems = new Array(nElem).fill(0);
  for (let i = 0; i < nElem; i++) {
    const xi = positions[i];
    const xj = positions[i+1];
    const mid = (xi + xj) / 2;
    let q = 0;
    udls.forEach(ud => {
      if (ud.a <= mid && mid <= ud.b) {
        q += ud.q;
      }
    });
    qElems[i] = q;
  }

  // Boundary conditions: [fix_v, fix_theta] per node
  const bc = [];
  for (let i = 0; i < nNodes; i++) {
    if (positions[i] === 0) {
      if (leftSupport === 'pinned' || leftSupport === 'roller') bc.push([1, 0]);
      else if (leftSupport === 'fixed') bc.push([1, 1]);
      else bc.push([0, 0]);
    } else if (positions[i] === L) {
      if (rightSupport === 'pinned' || rightSupport === 'roller') bc.push([1, 0]);
      else if (rightSupport === 'fixed') bc.push([1, 1]);
      else bc.push([0, 0]);
    } else {
      bc.push([0, 0]);
    }
  }

  // Apply boundary conditions from additional supports
  additionalSupports.forEach(supp => {
    const idx = positions.indexOf(supp.x);
    if (idx >= 0) {
      if (supp.type === 'pinned' || supp.type === 'roller') {
        bc[idx] = [1, 0];
      } else if (supp.type === 'fixed') {
        bc[idx] = [1, 1];
      } else if (supp.type === 'free') {
        bc[idx] = [0, 0];
      }
    }
  });

  // Check for free-floating (no vertical DOF fixed)
  let hasVerticalSupport = false;
  for (let i = 0; i < bc.length; i++) {
    if (bc[i][0] === 1) { hasVerticalSupport = true; break; }
  }

  // Determine analysis method based on supports
  let result;
  // Use finite element solver if there is at least one vertical support
  if (hasVerticalSupport) {
    const EI = 1; // We assume EI=1 for diagram shape; scaling not needed for shear/moment
    // Use a higher number of sampling points for improved numerical accuracy
    const Nsamp = 200;
    result = beamFEM(positions, qElems, nodeLoads, nodeMoments, bc, EI, Nsamp);
    if (!result) {
      alert('Failed to compute the beam. Please check your inputs.');
      return;
    }
  } else {
    // Free-floating beam: compute shear and moment without reactions
    const nSamples = 200;
    result = computeFreeBeam(L, pointLoads, udls, moments, nSamples);
  }

  /*
   * Recompute shear and moment diagrams based on reaction forces and applied loads.
   * The FEM solver returns bending moments (result.M) derived from curvature integration,
   * which can accumulate numerical errors when differentiated to obtain shear. To
   * produce accurate shear force and bending moment diagrams consistent with static
   * equilibrium, we reconstruct these diagrams here using the support reactions and
   * applied loads directly.
   */
  // Build a list of vertical reaction forces and moments from the FEM result
  const reactionForces = [];
  const reactionMoments = [];
  // reactions.ids contains global DOF indices; vals contains corresponding reaction values
  if (result.reactions && result.reactions.ids && result.reactions.vals) {
    for (let r = 0; r < result.reactions.ids.length; r++) {
      const dof = result.reactions.ids[r];
      const val = result.reactions.vals[r];
      const nodeIndex = Math.floor(dof / 2);
      const dofType = dof % 2; // 0: vertical, 1: moment
      const posX = positions[nodeIndex];
      if (dofType === 0) {
        // Vertical reaction force (positive upward)
        reactionForces.push({ pos: posX, val: val });
      } else {
        // Reaction moment
        reactionMoments.push({ pos: posX, val: val });
      }
    }
  }
  // For free-floating beams, compute virtual reactions at x=0 and x=L if no vertical reactions exist
  if (reactionForces.length === 0) {
    // Sum of point loads and distributed loads
    let Psum = 0;
    let M_P = 0;
    pointLoads.forEach(pl => { Psum += pl.P; M_P += pl.P * pl.x; });
    let Qsum = 0;
    let M_Q = 0;
    udls.forEach(ud => {
      const Qk = ud.q * (ud.b - ud.a);
      const xbar = 0.5 * (ud.a + ud.b);
      Qsum += Qk;
      M_Q += Qk * xbar;
    });
    let M_M = 0;
    moments.forEach(mo => { M_M += mo.M; });
    const RB = - (M_P + M_Q + M_M) / L;
    const RA = - (Psum + Qsum) - RB;
    reactionForces.push({ pos: 0, val: RA });
    reactionForces.push({ pos: L, val: RB });
  }
  // Helper function to compute shear and moment arrays from reactions and loads
  function computeShearAndMoment(xVals) {
    const shearArr = new Array(xVals.length).fill(0);
    const momentArr = new Array(xVals.length).fill(0);
    for (let i = 0; i < xVals.length; i++) {
      const xi = xVals[i];
      let shear = 0;
      // Add contributions from reaction forces
      reactionForces.forEach(sup => {
        if (xi >= sup.pos - 1e-12) shear += sup.val;
      });
      // Add contributions from point loads
      pointLoads.forEach(pl => {
        if (xi >= pl.x - 1e-12) shear += pl.P;
      });
      // Add contributions from distributed loads
      udls.forEach(ud => {
        if (xi >= ud.a - 1e-12) {
          const segEnd = Math.min(xi, ud.b);
          const length = Math.max(segEnd - ud.a, 0);
          shear += ud.q * length;
        }
      });
      shearArr[i] = shear;
      // Integrate shear to obtain bending moment using trapezoidal rule
      if (i === 0) {
        momentArr[i] = 0;
      } else {
        const dx = xVals[i] - xVals[i - 1];
        momentArr[i] = momentArr[i - 1] + 0.5 * (shearArr[i - 1] + shearArr[i]) * dx;
      }
      // Add contributions from point moments and reaction moments
      let mAdd = 0;
      moments.forEach(mo => {
        if (mo.x <= xi + 1e-12) mAdd += mo.M;
      });
      reactionMoments.forEach(rm => {
        if (rm.pos <= xi + 1e-12) mAdd += rm.val;
      });
      momentArr[i] += mAdd;
    }
    return { V: shearArr, M: momentArr };
  }
  // Use the x sampling points from the solver to compute shear and moment
  const sm = computeShearAndMoment(result.x);
  // Replace result.V and result.M with recomputed values
  result.V = sm.V;
  result.M = sm.M;

  // Plot shear force diagram with emphasised axes
  {
    const xVals = result.x;
    const yVals = result.V;
    // Determine y-range for vertical axis line
    let yMinV = Math.min(...yVals);
    let yMaxV = Math.max(...yVals);
    // In case of constant shear (zero range), expand a bit to show axis
    if (yMinV === yMaxV) {
      const delta = Math.abs(yMinV) > 0 ? Math.abs(yMinV) * 0.1 : 1;
      yMinV -= delta;
      yMaxV += delta;
    }
    const shapes = [
      // vertical axis at x = 0
      {
        type: 'line',
        xref: 'x', yref: 'y',
        x0: 0, y0: yMinV,
        x1: 0, y1: yMaxV,
        line: { color: '#000000', width: 2 }
      },
      // horizontal axis at y = 0
      {
        type: 'line',
        xref: 'x', yref: 'y',
        x0: 0, y0: 0,
        x1: xVals[xVals.length - 1], y1: 0,
        line: { color: '#000000', width: 2 }
      }
    ];
    Plotly.newPlot('sfdPlot', [{
      x: xVals,
      y: yVals,
      mode: 'lines',
      line: { width: 2 },
      name: 'Shear Force'
    }], {
      title: 'Shear Force Diagram',
      xaxis: {
        title: 'Position x [m]',
        showline: true,
        linecolor: '#000000',
        linewidth: 2,
        mirror: true,
        ticks: 'inside',
        showticklabels: true,
        zeroline: true,
        zerolinecolor: '#000000',
        zerolinewidth: 2
      },
      yaxis: {
        title: 'V(x) [kN]',
        showline: true,
        linecolor: '#000000',
        linewidth: 2,
        mirror: true,
        ticks: 'inside',
        showticklabels: true,
        zeroline: true,
        zerolinecolor: '#000000',
        zerolinewidth: 2
      },
      shapes: shapes,
      showlegend: false,
      margin: { t: 40, r: 20, b: 50, l: 60 }
    });
  }

  // Plot bending moment diagram with emphasised axes
  {
    const xVals = result.x;
    const yVals = result.M;
    let yMinM = Math.min(...yVals);
    let yMaxM = Math.max(...yVals);
    if (yMinM === yMaxM) {
      const delta = Math.abs(yMinM) > 0 ? Math.abs(yMinM) * 0.1 : 1;
      yMinM -= delta;
      yMaxM += delta;
    }
    const shapes = [
      {
        type: 'line',
        xref: 'x', yref: 'y',
        x0: 0, y0: yMinM,
        x1: 0, y1: yMaxM,
        line: { color: '#000000', width: 2 }
      },
      {
        type: 'line',
        xref: 'x', yref: 'y',
        x0: 0, y0: 0,
        x1: xVals[xVals.length - 1], y1: 0,
        line: { color: '#000000', width: 2 }
      }
    ];
    Plotly.newPlot('bmdPlot', [{
      x: xVals,
      y: yVals,
      mode: 'lines',
      line: { width: 2 },
      name: 'Bending Moment'
    }], {
      title: 'Bending Moment Diagram',
      xaxis: {
        title: 'Position x [m]',
        showline: true,
        linecolor: '#000000',
        linewidth: 2,
        mirror: true,
        ticks: 'inside',
        showticklabels: true,
        zeroline: true,
        zerolinecolor: '#000000',
        zerolinewidth: 2
      },
      yaxis: {
        title: 'M(x) [kN·m]',
        showline: true,
        linecolor: '#000000',
        linewidth: 2,
        mirror: true,
        ticks: 'inside',
        showticklabels: true,
        zeroline: true,
        zerolinecolor: '#000000',
        zerolinewidth: 2
      },
      shapes: shapes,
      showlegend: false,
      margin: { t: 40, r: 20, b: 50, l: 60 }
    });
  }

  // Plot deflection and stress diagrams
  // Read material/section properties with fallbacks
  let E_val = parseFloat(document.getElementById('elasticModulus')?.value);
  if (isNaN(E_val) || E_val <= 0) E_val = 1;
  let I_val = parseFloat(document.getElementById('momentInertia')?.value);
  if (isNaN(I_val) || I_val <= 0) I_val = 1;
  let h_val = parseFloat(document.getElementById('sectionDepth')?.value);
  if (isNaN(h_val) || h_val <= 0) h_val = 1;
  const c_val = h_val / 2;
  // Compute deflection scaled by 1/(E*I) since solver used EI=1
  const deflection = result.v.map(vv => vv / (E_val * I_val));
  // Compute bending stress at extreme fiber: sigma = M*c/I
  const stress = result.M.map(mVal => (mVal * c_val) / I_val);

  // Store the latest computed arrays globally for animation later.
  // We copy the arrays to avoid mutation during animation.
  window.latestResult = {
    x: result.x.slice(),
    V: result.V.slice(),
    M: result.M.slice(),
    deflection: deflection.slice(),
    stress: stress.slice()
  };
  // Plot deflection diagram with emphasised axes
  {
    const xValsDef = result.x;
    const yValsDef = deflection;
    let yMinDef = Math.min(...yValsDef);
    let yMaxDef = Math.max(...yValsDef);
    if (yMinDef === yMaxDef) {
      const delta = Math.abs(yMinDef) > 0 ? Math.abs(yMinDef) * 0.1 : 1;
      yMinDef -= delta;
      yMaxDef += delta;
    }
    const shapesDef = [
      {
        type: 'line',
        xref: 'x', yref: 'y',
        x0: 0, y0: yMinDef,
        x1: 0, y1: yMaxDef,
        line: { color: '#000000', width: 2 }
      },
      {
        type: 'line',
        xref: 'x', yref: 'y',
        x0: 0, y0: 0,
        x1: xValsDef[xValsDef.length - 1], y1: 0,
        line: { color: '#000000', width: 2 }
      }
    ];
    Plotly.newPlot('deflectionPlot', [{
      x: xValsDef,
      y: yValsDef,
      mode: 'lines',
      line: { width: 2 },
      name: 'Deflection'
    }], {
      title: 'Deflection Diagram',
      xaxis: {
        title: 'Position x [m]',
        showline: true,
        linecolor: '#000000',
        linewidth: 2,
        mirror: true,
        ticks: 'inside',
        showticklabels: true,
        zeroline: true,
        zerolinecolor: '#000000',
        zerolinewidth: 2
      },
      yaxis: {
        title: 'Deflection',
        showline: true,
        linecolor: '#000000',
        linewidth: 2,
        mirror: true,
        ticks: 'inside',
        showticklabels: true,
        zeroline: true,
        zerolinecolor: '#000000',
        zerolinewidth: 2
      },
      shapes: shapesDef,
      showlegend: false,
      margin: { t: 40, r: 20, b: 50, l: 60 }
    });
  }
  // Plot stress diagram with emphasised axes
  {
    const xValsStr = result.x;
    const yValsStr = stress;
    let yMinStr = Math.min(...yValsStr);
    let yMaxStr = Math.max(...yValsStr);
    if (yMinStr === yMaxStr) {
      const delta = Math.abs(yMinStr) > 0 ? Math.abs(yMinStr) * 0.1 : 1;
      yMinStr -= delta;
      yMaxStr += delta;
    }
    const shapesStr = [
      {
        type: 'line',
        xref: 'x', yref: 'y',
        x0: 0, y0: yMinStr,
        x1: 0, y1: yMaxStr,
        line: { color: '#000000', width: 2 }
      },
      {
        type: 'line',
        xref: 'x', yref: 'y',
        x0: 0, y0: 0,
        x1: xValsStr[xValsStr.length - 1], y1: 0,
        line: { color: '#000000', width: 2 }
      }
    ];
    Plotly.newPlot('stressPlot', [{
      x: xValsStr,
      y: yValsStr,
      mode: 'lines',
      line: { width: 2 },
      name: 'Stress'
    }], {
      title: 'Bending Stress Diagram',
      xaxis: {
        title: 'Position x [m]',
        showline: true,
        linecolor: '#000000',
        linewidth: 2,
        mirror: true,
        ticks: 'inside',
        showticklabels: true,
        zeroline: true,
        zerolinecolor: '#000000',
        zerolinewidth: 2
      },
      yaxis: {
        title: 'Stress',
        showline: true,
        linecolor: '#000000',
        linewidth: 2,
        mirror: true,
        ticks: 'inside',
        showticklabels: true,
        zeroline: true,
        zerolinecolor: '#000000',
        zerolinewidth: 2
      },
      shapes: shapesStr,
      showlegend: false,
      margin: { t: 40, r: 20, b: 50, l: 60 }
    });
  }

  // Display reactions (support reactions)
  const reactions = result.reactions;
  let reactStr = '';
  for (let i = 0; i < reactions.ids.length; i++) {
    const dof = reactions.ids[i];
    const val = reactions.vals[i];
    const nodeIndex = Math.floor(dof / 2);
    const dofType = (dof % 2 === 0) ? 'Vertical Reaction' : 'Moment Reaction';
    reactStr += `Node at x=${positions[nodeIndex]} m, ${dofType}: ${val.toFixed(3)}`;
    if (dofType === 'Moment Reaction') reactStr += ' kN·m';
    else reactStr += ' kN';
    reactStr += '<br>';
  }
  document.getElementById('reactionResults').innerHTML = reactStr;
}

/**
 * Animate the shear force, bending moment, deflection and stress diagrams.
 * This function progressively reveals each curve from left to right using
 * a timed interval. It requires that computeBeam() has been called at
 * least once to populate window.latestResult with the computed arrays.
 */
function animateDiagrams() {
  // Ensure there is a result to animate
  if (!window.latestResult || !window.latestResult.x) {
    alert('Please compute the diagrams before animating.');
    return;
  }
  const xVals = window.latestResult.x;
  const shearVals = window.latestResult.V;
  const momentVals = window.latestResult.M;
  const deflectionVals = window.latestResult.deflection;
  const stressVals = window.latestResult.stress;
  const nPts = xVals.length;

  // Compute y-ranges for each diagram using full arrays to ensure axes remain fixed
  // Shear
  let yMinV = Math.min(...shearVals);
  let yMaxV = Math.max(...shearVals);
  if (yMinV === yMaxV) {
    const delta = Math.abs(yMinV) > 0 ? Math.abs(yMinV) * 0.1 : 1;
    yMinV -= delta;
    yMaxV += delta;
  }
  const shapesV = [
    { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: yMinV, x1: 0, y1: yMaxV, line: { color: '#000000', width: 2 } },
    { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: 0, x1: xVals[nPts - 1], y1: 0, line: { color: '#000000', width: 2 } }
  ];
  const layoutShear = {
    title: 'Shear Force Diagram (Animated)',
    xaxis: {
      title: 'Position x [m]',
      showline: true,
      linecolor: '#000000',
      linewidth: 2,
      mirror: true,
      ticks: 'inside',
      showticklabels: true,
      zeroline: true,
      zerolinecolor: '#000000',
      zerolinewidth: 2
    },
    yaxis: {
      title: 'V(x) [kN]',
      showline: true,
      linecolor: '#000000',
      linewidth: 2,
      mirror: true,
      ticks: 'inside',
      showticklabels: true,
      zeroline: true,
      zerolinecolor: '#000000',
      zerolinewidth: 2
    },
    shapes: shapesV,
    showlegend: false,
    margin: { t: 40, r: 20, b: 50, l: 60 }
  };
  // Bending moment ranges
  let yMinM = Math.min(...momentVals);
  let yMaxM = Math.max(...momentVals);
  if (yMinM === yMaxM) {
    const delta = Math.abs(yMinM) > 0 ? Math.abs(yMinM) * 0.1 : 1;
    yMinM -= delta;
    yMaxM += delta;
  }
  const shapesM = [
    { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: yMinM, x1: 0, y1: yMaxM, line: { color: '#000000', width: 2 } },
    { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: 0, x1: xVals[nPts - 1], y1: 0, line: { color: '#000000', width: 2 } }
  ];
  const layoutMoment = {
    title: 'Bending Moment Diagram (Animated)',
    xaxis: {
      title: 'Position x [m]',
      showline: true,
      linecolor: '#000000',
      linewidth: 2,
      mirror: true,
      ticks: 'inside',
      showticklabels: true,
      zeroline: true,
      zerolinecolor: '#000000',
      zerolinewidth: 2
    },
    yaxis: {
      title: 'M(x) [kN·m]',
      showline: true,
      linecolor: '#000000',
      linewidth: 2,
      mirror: true,
      ticks: 'inside',
      showticklabels: true,
      zeroline: true,
      zerolinecolor: '#000000',
      zerolinewidth: 2
    },
    shapes: shapesM,
    showlegend: false,
    margin: { t: 40, r: 20, b: 50, l: 60 }
  };
  // Deflection ranges
  let yMinDef = Math.min(...deflectionVals);
  let yMaxDef = Math.max(...deflectionVals);
  if (yMinDef === yMaxDef) {
    const delta = Math.abs(yMinDef) > 0 ? Math.abs(yMinDef) * 0.1 : 1;
    yMinDef -= delta;
    yMaxDef += delta;
  }
  const shapesDef = [
    { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: yMinDef, x1: 0, y1: yMaxDef, line: { color: '#000000', width: 2 } },
    { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: 0, x1: xVals[nPts - 1], y1: 0, line: { color: '#000000', width: 2 } }
  ];
  const layoutDeflection = {
    title: 'Deflection Diagram (Animated)',
    xaxis: {
      title: 'Position x [m]',
      showline: true,
      linecolor: '#000000',
      linewidth: 2,
      mirror: true,
      ticks: 'inside',
      showticklabels: true,
      zeroline: true,
      zerolinecolor: '#000000',
      zerolinewidth: 2
    },
    yaxis: {
      title: 'Deflection',
      showline: true,
      linecolor: '#000000',
      linewidth: 2,
      mirror: true,
      ticks: 'inside',
      showticklabels: true,
      zeroline: true,
      zerolinecolor: '#000000',
      zerolinewidth: 2
    },
    shapes: shapesDef,
    showlegend: false,
    margin: { t: 40, r: 20, b: 50, l: 60 }
  };
  // Stress ranges
  let yMinStr = Math.min(...stressVals);
  let yMaxStr = Math.max(...stressVals);
  if (yMinStr === yMaxStr) {
    const delta = Math.abs(yMinStr) > 0 ? Math.abs(yMinStr) * 0.1 : 1;
    yMinStr -= delta;
    yMaxStr += delta;
  }
  const shapesStress = [
    { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: yMinStr, x1: 0, y1: yMaxStr, line: { color: '#000000', width: 2 } },
    { type: 'line', xref: 'x', yref: 'y', x0: 0, y0: 0, x1: xVals[nPts - 1], y1: 0, line: { color: '#000000', width: 2 } }
  ];
  const layoutStress = {
    title: 'Bending Stress Diagram (Animated)',
    xaxis: {
      title: 'Position x [m]',
      showline: true,
      linecolor: '#000000',
      linewidth: 2,
      mirror: true,
      ticks: 'inside',
      showticklabels: true,
      zeroline: true,
      zerolinecolor: '#000000',
      zerolinewidth: 2
    },
    yaxis: {
      title: 'Stress',
      showline: true,
      linecolor: '#000000',
      linewidth: 2,
      mirror: true,
      ticks: 'inside',
      showticklabels: true,
      zeroline: true,
      zerolinecolor: '#000000',
      zerolinewidth: 2
    },
    shapes: shapesStress,
    showlegend: false,
    margin: { t: 40, r: 20, b: 50, l: 60 }
  };

  // Start the animation loop. Clear any existing interval first.
  if (window.animationInterval) {
    clearInterval(window.animationInterval);
  }
  let index = 1;
  window.animationInterval = setInterval(() => {
    if (index > nPts) {
      clearInterval(window.animationInterval);
      return;
    }
    const xi = xVals.slice(0, index);
    const Vi = shearVals.slice(0, index);
    const Mi = momentVals.slice(0, index);
    const Di = deflectionVals.slice(0, index);
    const Si = stressVals.slice(0, index);
    Plotly.react('sfdPlot', [ { x: xi, y: Vi, mode: 'lines', line: { width: 2 } } ], layoutShear);
    Plotly.react('bmdPlot', [ { x: xi, y: Mi, mode: 'lines', line: { width: 2 } } ], layoutMoment);
    Plotly.react('deflectionPlot', [ { x: xi, y: Di, mode: 'lines', line: { width: 2 } } ], layoutDeflection);
    Plotly.react('stressPlot', [ { x: xi, y: Si, mode: 'lines', line: { width: 2 } } ], layoutStress);
    index++;
  }, 50);
}

// Finite element solver for Euler–Bernoulli beam with constant EI and distributed loads
function beamFEM(positions, qElems, nodeLoads, nodeMoments, bc, EI, Nsamp) {
  const nNodes = positions.length;
  const nDof = 2 * nNodes;
  const nElem = nNodes - 1;

  // Initialize global stiffness matrix K and load vector F
  const K = new Array(nDof);
  const F = new Array(nDof).fill(0);
  for (let i = 0; i < nDof; i++) {
    K[i] = new Array(nDof).fill(0);
  }

  // Assemble node concentrated loads and moments into F
  for (let n = 0; n < nNodes; n++) {
    F[2*n]     += nodeLoads[n];    // vertical load
    F[2*n + 1] += nodeMoments[n];  // moment
  }

  // Assemble element stiffness and consistent load vectors
  for (let e = 0; e < nElem; e++) {
    const ni = e;
    const nj = e + 1;
    const xi = positions[ni];
    const xj = positions[nj];
    const Le = xj - xi;
    // Local stiffness matrix (4x4)
    let ke = [
      [ 12,      6*Le,    -12,     6*Le ],
      [ 6*Le,  4*Le*Le,  -6*Le,  2*Le*Le ],
      [ -12,    -6*Le,     12,    -6*Le ],
      [ 6*Le,  2*Le*Le,  -6*Le,  4*Le*Le ]
    ];
    const factor = EI / (Le * Le * Le);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        ke[r][c] *= factor;
      }
    }
    // Consistent load vector for distributed load q on element e
    const q = qElems[e];
    const fe = [ q * Le / 2,  q * Le * Le / 12,  q * Le / 2,  -q * Le * Le / 12 ];
    // Global DOF indices
    const dofs = [ 2*ni, 2*ni+1, 2*nj, 2*nj+1 ];
    // Assemble into K
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        K[dofs[r]][dofs[c]] += ke[r][c];
      }
    }
    // Assemble into F
    for (let r = 0; r < 4; r++) {
      F[dofs[r]] += fe[r];
    }
  }

  // Determine fixed and free DOFs based on boundary conditions
  const fixedDofs = [];
  for (let n = 0; n < nNodes; n++) {
    if (bc[n][0] === 1) fixedDofs.push(2*n);    // displacement fixed
    if (bc[n][1] === 1) fixedDofs.push(2*n + 1); // rotation fixed
  }
  const freeDofs = [];
  for (let i = 0; i < nDof; i++) {
    if (!fixedDofs.includes(i)) freeDofs.push(i);
  }

  // Build reduced K and F for free DOFs
  const nFree = freeDofs.length;
  const Kred = new Array(nFree);
  const Fred = new Array(nFree).fill(0);
  for (let i = 0; i < nFree; i++) {
    Kred[i] = new Array(nFree).fill(0);
  }
  for (let i = 0; i < nFree; i++) {
    const gi = freeDofs[i];
    Fred[i] = F[gi];
    for (let j = 0; j < nFree; j++) {
      const gj = freeDofs[j];
      Kred[i][j] = K[gi][gj];
    }
  }

  // Solve for free displacements
  let u_free;
  try {
    u_free = solveLinear(Kred, Fred);
  } catch (err) {
    console.error(err);
    return null;
  }
  // Build full displacement vector u
  const u = new Array(nDof).fill(0);
  for (let i = 0; i < nFree; i++) {
    u[ freeDofs[i] ] = u_free[i];
  }

  // Compute reaction forces/moments at fixed DOFs: R = K*u - F
  const KU = new Array(nDof).fill(0);
  for (let i = 0; i < nDof; i++) {
    let sum = 0;
    for (let j = 0; j < nDof; j++) {
      sum += K[i][j] * u[j];
    }
    KU[i] = sum;
  }
  const reactions = { ids: [], vals: [] };
  for (let i = 0; i < fixedDofs.length; i++) {
    const idx = fixedDofs[i];
    reactions.ids.push(idx);
    reactions.vals.push(KU[idx] - F[idx]);
  }

  // Compute shear, moment, and displacement diagrams by sampling along each element
  const x_all = [];
  const M_all = [];
  const v_all = [];
  // Sample along each element
  for (let e = 0; e < nElem; e++) {
    const ni = e;
    const nj = e + 1;
    const xi = positions[ni];
    const xj = positions[nj];
    const Le = xj - xi;
    const dofs = [ 2*ni, 2*ni+1, 2*nj, 2*nj+1 ];
    const ue = [ u[dofs[0]], u[dofs[1]], u[dofs[2]], u[dofs[3]] ];
    const q = qElems[e];
    const Mi = q * Le * Le / 12;
    const Mj = -q * Le * Le / 12;
    for (let k = 0; k < Nsamp; k++) {
      const s = (Le / (Nsamp - 1)) * k;
      // Second derivatives of shape functions for moment
      const d2N1 = (-6 / (Le * Le)) + (12 * s) / (Le * Le * Le);
      const d2N2 = (-4 / Le) + (6 * s) / (Le * Le);
      const d2N3 = (6 / (Le * Le)) - (12 * s) / (Le * Le * Le);
      const d2N4 = (-2 / Le) + (6 * s) / (Le * Le);
      const M_u = EI * ( d2N1 * ue[0] + d2N2 * ue[1] + d2N3 * ue[2] + d2N4 * ue[3] );
      // Distributed load contribution to moment
      const M_q = Mi * (1 - s / Le) + Mj * (s / Le) + q * s * (Le - s) / 2;
      const Mtot = M_u + M_q;
      x_all.push(xi + s);
      M_all.push(Mtot);
      // Displacement v(s) using shape functions
      const sOverL = s / Le;
      const N1 = 1 - 3 * sOverL * sOverL + 2 * sOverL * sOverL * sOverL;
      const N2 = s * (1 - 2 * sOverL + sOverL * sOverL);
      const N3 = 3 * sOverL * sOverL - 2 * sOverL * sOverL * sOverL;
      const N4 = s * (sOverL * sOverL - sOverL);
      const v_s = N1 * ue[0] + N2 * ue[1] + N3 * ue[2] + N4 * ue[3];
      v_all.push(v_s);
    }
  }
  // Compute shear by numerical derivative of M(x)
  const nPts = x_all.length;
  const V_all = new Array(nPts).fill(0);
  for (let i = 0; i < nPts; i++) {
    if (i === 0) {
      const dx = x_all[i+1] - x_all[i];
      V_all[i] = -(M_all[i+1] - M_all[i]) / dx;
    } else if (i === nPts - 1) {
      const dx = x_all[i] - x_all[i-1];
      V_all[i] = -(M_all[i] - M_all[i-1]) / dx;
    } else {
      const dx = x_all[i+1] - x_all[i-1];
      V_all[i] = -(M_all[i+1] - M_all[i-1]) / dx;
    }
  }
  // Merge points with identical x (avoiding duplicates at element boundaries)
  const resultX = [];
  const resultM = [];
  const resultV = [];
  const resultDefl = [];
  for (let i = 0; i < x_all.length; i++) {
    const xVal = parseFloat(x_all[i].toFixed(6));
    if (resultX.length === 0 || xVal > resultX[resultX.length - 1] + 1e-10) {
      resultX.push(xVal);
      resultM.push(M_all[i]);
      resultV.push(V_all[i]);
      resultDefl.push(v_all[i]);
    }
  }
  return { x: resultX, M: resultM, V: resultV, v: resultDefl, reactions: reactions };
}

// Solve a linear system using Gaussian elimination with partial pivoting
function solveLinear(A, b) {
  const n = b.length;
  // Create deep copies of A and b to avoid mutating the originals
  const M = [];
  for (let i = 0; i < n; i++) {
    M[i] = A[i].slice();
  }
  const x = b.slice();
  // Forward elimination
  for (let k = 0; k < n; k++) {
    // Find pivot row
    let maxRow = k;
    let maxVal = Math.abs(M[k][k]);
    for (let i = k + 1; i < n; i++) {
      const val = Math.abs(M[i][k]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = i;
      }
    }
    if (maxVal < 1e-12) {
      throw new Error('Singular matrix encountered');
    }
    // Swap rows in M and x
    if (maxRow !== k) {
      const tempRow = M[k]; M[k] = M[maxRow]; M[maxRow] = tempRow;
      const tempVal = x[k]; x[k] = x[maxRow]; x[maxRow] = tempVal;
    }
    // Eliminate entries below the pivot
    for (let i = k + 1; i < n; i++) {
      const factor = M[i][k] / M[k][k];
      for (let j = k; j < n; j++) {
        M[i][j] -= factor * M[k][j];
      }
      x[i] -= factor * x[k];
    }
  }
  // Back substitution
  const sol = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = x[i];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * sol[j];
    }
    sol[i] = sum / M[i][i];
  }
  return sol;
}

// Compute shear, moment, and deflection for a beam with no vertical supports (free-floating).
// For such cases, internal shear and moment distributions can still be determined
// by enforcing static equilibrium using "virtual" reactions at the beam ends.
// These reactions (RA at x=0 and RB at x=L) balance the applied loads and
// moments, ensuring ΣFy = 0 and ΣM@x=0 = 0. Shear and moment are then
// integrated using these reactions and the applied load contributions.
function computeFreeBeam(L, pointLoads, udls, moments, nSamples) {
  const n = nSamples || 200;
  const dx = L / (n - 1);
  // Sum of point loads and distributed load resultants
  let Psum = 0;
  let M_P = 0;
  pointLoads.forEach(pl => {
    Psum += pl.P;
    M_P += pl.P * pl.x;
  });
  let Qsum = 0;
  let M_Q = 0;
  udls.forEach(ud => {
    const q = ud.q;
    const a = ud.a;
    const b = ud.b;
    const Qk = q * (b - a);
    const xbar = 0.5 * (a + b);
    Qsum += Qk;
    M_Q += Qk * xbar;
  });
  let M_M = 0;
  moments.forEach(mo => {
    M_M += mo.M;
  });
  // Compute "virtual" reactions at the beam ends using static equilibrium
  const RB = -(M_P + M_Q + M_M) / L;
  const RA = -(Psum + Qsum) - RB;
  // Initialize arrays for x, shear V, moment M, slope and deflection
  const xVals = [];
  const VVals = [];
  const MVals = [];
  const slope = [];
  const defl = [];
  for (let i = 0; i < n; i++) {
    const xi = i * dx;
    xVals.push(xi);
    // Compute shear at xi: start with RA
    let shear = RA;
    // Contribution from point loads: add the load magnitude after its position
    pointLoads.forEach(pl => {
      if (pl.x <= xi + 1e-12) shear += pl.P;
    });
    // Contribution from distributed loads: integrate q over [a, min(xi,b)]
    udls.forEach(ud => {
      if (xi >= ud.a) {
        const segEnd = Math.min(xi, ud.b);
        const length = Math.max(segEnd - ud.a, 0);
        shear += ud.q * length;
      }
    });
    // Add RB at the right end for xi >= L
    if (xi >= L - 1e-12) {
      shear += RB;
    }
    VVals.push(shear);
    // Moment by integrating shear (trapezoidal rule)
    if (i === 0) {
      MVals.push(0);
    } else {
      MVals.push(MVals[i-1] + 0.5 * (VVals[i-1] + VVals[i]) * dx);
    }
  }
  // Add contributions from applied concentrated moments
  for (let j = 0; j < MVals.length; j++) {
    const xi = xVals[j];
    let mAdd = 0;
    moments.forEach(mo => {
      if (mo.x <= xi + 1e-12) mAdd += mo.M;
    });
    MVals[j] += mAdd;
  }
  // Integrate moment to get slope and deflection (assuming zero slope and deflection at x=0)
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      slope.push(0);
      defl.push(0);
    } else {
      slope.push(slope[i-1] + 0.5 * (MVals[i-1] + MVals[i]) * dx);
      defl.push(defl[i-1] + 0.5 * (slope[i-1] + slope[i]) * dx);
    }
  }
  return {
    x: xVals,
    V: VVals,
    M: MVals,
    v: defl,
    reactions: { ids: [], vals: [] }
  };
}