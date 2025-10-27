// ---- Config ----
const duration = 400;
const horizontalSpacing = 180;
const verticalSpacing = 60;
let rootData, root, treeLayout;
let nodeIdCounter = 0;
let nodeMap = {};

// ---- Layout ----
const leftPadding = 50;
const extraTopGap = 20;
const extraBottomPadding = 50;

function measureLayout() {
  const navbar = document.querySelector("h1");
  const navbarHeight = navbar ? (navbar.offsetHeight + 10) : 60;
  const topPadding = navbarHeight + extraTopGap;
  return { topPadding };
}

let layout = measureLayout();

// ---- SVG setup ----
const svg = d3.select("#tree-container");
svg.select("g.tree-root").remove();
const g = svg.append("g").attr("class", "tree-root");

// ---- Load JSON ----
d3.json("data.json").then(data => {
  rootData = data;
  assignIds(rootData);
  root = d3.hierarchy(rootData);
  treeLayout = d3.tree().nodeSize([verticalSpacing, horizontalSpacing]);
  if (root.children) root.children.forEach(collapse);
  update(root);
});

// ---- Helpers ----
function assignIds(node) {
  if (node._id === undefined) node._id = nodeIdCounter++;
  nodeMap[node._id] = node;
  if (node.children) node.children.forEach(assignIds);
}

function collapse(d) {
  if (d.children) {
    d._children = d.children;
    d._children.forEach(collapse);
    d.children = null;
  }
}

// ---- Search ----
let searchTerm = "";
d3.select("#searchInput").on("input", function() {
  searchTerm = this.value.trim().toLowerCase();

  function searchAndHighlight(node) {
    let match = node.data.name && node.data.name.toLowerCase().includes(searchTerm);
    let childMatch = false;

    if (node.children) node.children.forEach(c => { if(searchAndHighlight(c)) childMatch = true; });
    if (node._children) node._children.forEach(c => { if(searchAndHighlight(c)) childMatch = true; });

    if (childMatch || match) {
      if (node._children) { node.children = node._children; node._children = null; }
    } else {
      if (node.children) { node._children = node.children; node.children = null; }
    }

    node.match = match;
    return match || childMatch;
  }

  if(searchTerm === "") {
    if(root.children) root.children.forEach(collapse);
  } else {
    searchAndHighlight(root);
  }

  update(root);
});

// ---- Update Function ----
function update(source) {
  layout = measureLayout();
  treeLayout(root);

  const nodes = root.descendants();
  const links = root.links();

  const padding = 50;
  const minX = d3.min(nodes, d => d.x);
  const maxX = d3.max(nodes, d => d.x);
  const minY = d3.min(nodes, d => d.y);
  const maxY = d3.max(nodes, d => d.y);

  const svgWidth = maxY - minY + padding*2 + leftPadding;
  const svgHeight = maxX - minX + padding*2 + layout.topPadding + extraBottomPadding;

  svg.attr("width", svgWidth)
     .attr("height", svgHeight);

  g.attr("transform", `translate(${padding + leftPadding}, ${padding + layout.topPadding - minX})`);

  // ---- Nodes ----
  const node = g.selectAll(".node").data(nodes, d => d.data._id);
  const nodeEnter = node.enter().append("g")
    .attr("class", "node")
    .attr("transform", d => `translate(${source.y0||0},${source.x0||0})`)
    .on("click", (event,d) => {
      if(d.children){ d._children=d.children; d.children=null; } 
      else { d.children=d._children; d._children=null; }
      update(d);
      if(!d.children && !d._children && d.data.url) window.open(d.data.url,"_blank");
    });

  const maxWidth = 220;
  nodeEnter.append("rect")
    .attr("width", d => Math.min(maxWidth, Math.max(80, (d.data.name||"").length*9)))
    .attr("height",24)
    .attr("x",0).attr("y",-12)
    .attr("rx",6).attr("ry",6)
    .attr("class","node-rect");

  nodeEnter.append("text")
    .attr("dx",6).attr("dy",3)
    .text(d => (d.data.name && d.data.name.length > 25) ? d.data.name.slice(0,22) + "..." : d.data.name)
    .attr("class","node-text");

  const nodeUpdate = nodeEnter.merge(node);
  nodeUpdate.transition().duration(duration)
    .attr("transform", d => `translate(${d.y},${d.x})`);

  // ---- Highlight search matches ----
  nodeUpdate.select("rect")
    .attr("stroke", d => d.match ? "#ff6b6b" : "#3aa4ff")
    .attr("stroke-width", d => d.match ? 4 : 2);

  nodeUpdate.select("text")
    .attr("fill", d => d.match ? "#ff6b6b" : "#e6eef6");

  node.exit().transition().duration(duration)
    .attr("transform", d => `translate(${source.y||0},${source.x||0})`)
    .remove();

  // ---- Links ----
  const link = g.selectAll(".link").data(links, d => d.target.data._id);
  const linkEnter = link.enter().insert("path","g")
    .attr("class","link")
    .attr("d", d => diagonal({x:source.x0||0,y:source.y0||0},{x:source.x0||0,y:source.y0||0}));

  linkEnter.merge(link).transition().duration(duration)
    .attr("d", d => diagonal(d.source,d.target));

  link.exit().transition().duration(duration)
    .attr("d", d => diagonal({x:source.x,y:source.y},{x:source.x,y:source.y}))
    .remove();

  nodes.forEach(d=>{ d.x0=d.x; d.y0=d.y; });
}

// ---- Diagonal ----
function diagonal(s,t) {
  return `M ${s.y} ${s.x} C ${(s.y+t.y)/2} ${s.x}, ${(s.y+t.y)/2} ${t.x}, ${t.y} ${t.x}`;
}

// ---- Window Resize ----
window.addEventListener("resize", ()=>update(root));
