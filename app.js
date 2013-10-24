/**
 * Bayes Ball Algorithm -- application code
 * 
 * Dependencies: D3, BBA
 *
 * Copyright (c) 2013 Charles Yuan Gao
 * Derived from Ross Kirsling's Model Logic Playground (http://github.com/rkirsling/modallogic)
 * Released under the MIT License.
 */

// set up initial BBA model (loads saved model if available, default otherwise)
var model = new BBA.Model(),
    modelString = 'OFC2;OFC2;OFC3,4;OFC;OFC;';

var modelParam = window.location.search.match(/\?model=(.*)/);
if(modelParam) modelString = modelParam[1];

model.loadFromModelString(modelString);

// set up initial states and edges based on the model
var lastNodeId = -1,
    nodes = [],
    links = [];

// --> nodes setup
var states = model.getStatesObservation();
states.forEach(function(state) {
  var node = {id: ++lastNodeId, observed: state};
  nodes.push(node);
});

// --> links setup
nodes.forEach(function(source) {
  var sourceId = source.id,
      children = model.getChildren(sourceId);
  children.forEach(function(targetId) {
    var target = nodes.filter(function(node) { return node.id === targetId; })[0];
    links.push({source: source, target: target, bayesBall: false});
  });
});

// set up SVG for D3
var width  = 640,
    height = 540;

var svg = d3.select('#app-body .graph')
  .append('svg')
  .attr('width', width)
  .attr('height', height);

// init D3 force layout
var force = d3.layout.force()
    .nodes(nodes)
    .links(links)
    .size([width, height])
    .linkDistance(150)
    .charge(-500)
    .on('tick', tick)

// define arrow markers for graph links
svg.append('svg:defs').append('svg:marker')
    .attr('id', 'end-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 6)
    .attr('markerWidth', 3)
    .attr('markerHeight', 3)
    .attr('orient', 'auto')
  .append('svg:path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#000');

svg.append('svg:defs').append('svg:marker')
    .attr('id', 'end-arrow-bayesBall')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 6)
    .attr('markerWidth', 5)
    .attr('markerHeight', 5)
    .attr('orient', 'auto')
  .append('svg:path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#00ff00');

// line displayed when dragging new nodes
var drag_line = svg.append('svg:path')
  .attr('class', 'link dragline hidden')
  .attr('d', 'M0,0L0,0');

// handles to link and node element groups
var path = svg.append('svg:g').selectAll('path'),
    circle = svg.append('svg:g').selectAll('g');

// mouse event vars
var selected_node = null,
    selected_link = null,
    mousedown_link = null,
    mousedown_node = null,
    mouseup_node = null;

function resetMouseVars() {
  mousedown_node = null;
  mouseup_node = null;
  mousedown_link = null;
}

// link to the model
var backdrop = d3.select('.modal-backdrop'),
    linkDialog = d3.select('#link-dialog'),
    linkInputElem = linkDialog.select('input').node();

function showLinkDialog() {
  linkInputElem.value = 'http://www.charlegao.com/bayesballalgorithm?model=' + model.getModelString(); 

  backdrop.classed('inactive', false);
  setTimeout(function() { backdrop.classed('in', true); linkDialog.classed('inactive', false); }, 0);
  setTimeout(function() { linkDialog.classed('in', true); }, 150);
}

function hideLinkDialog() {
  linkDialog.classed('in', false);
  setTimeout(function() { linkDialog.classed('inactive', true); backdrop.classed('in', false); }, 150);
  setTimeout(function() { backdrop.classed('inactive', true); }, 300);
}

// set selected node 
function setSelectedNode(node) {
  selected_node = node;
}

var n, m;

// play the animation to illustrate the process of Bayes Ball Algorithm
function animate(queue){
  var time = 0;
  var nodeList = [];
  n = 0;
  m = queue.length;
  while (queue.length > 0){
    node = queue.shift();
    links.push({source: node.from, target: node.to, bayesBall: true});
    restart();
    path.transition()
    .duration(1000)
    .delay(time*1000)
    .style('opacity', 1.0)
    .each('end', function(d) {
      if (d.bayesBall) ++n;
      if (d.bayesBall && n == m*(m+1)/2){
        // remove all bayesBall illustration edges
        links = _(links).reject(function(d){return d.bayesBall;});
        restart();
      }
    });
    time++;
  }
}

// run the Bayes Ball Algorithm
function run(){
  if (!selected_node){
    d3.select('.graph .alert').classed('alert-error', true);
    d3.select('.graph .alert .close').text("You have to select a node!");
    d3.select('.graph .alert').classed('hidden', false);
    return;
  }
  var playQueue = BBA.bayesBall(model, selected_node.id);
  if (playQueue == null){ // not a DAG
    d3.select('.graph .alert').classed('alert-error', true);
    d3.select('.graph .alert .close').text("The graph is not a directed acyclic graph.");
    d3.select('.graph .alert').classed('hidden', false);
  }else{
    hideAlert();
    playQueue.shift();
    animate(playQueue);
  }
}

// hide the alert message
function hideAlert(){
  d3.select('.graph .alert').classed('hidden', true);
}

// update force layout (called automatically each iteration)
function tick() {
  // draw directed edges with proper padding from node centers
  path.attr('d', function(d) {
    var deltaX = d.target.x - d.source.x,
        deltaY = d.target.y - d.source.y,
        dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
        normX = deltaX / dist,
        normY = deltaY / dist,
        sourcePadding = 12,
        targetPadding = 17,
        sourceX = d.source.x + (sourcePadding * normX),
        sourceY = d.source.y + (sourcePadding * normY),
        targetX = d.target.x - (targetPadding * normX),
        targetY = d.target.y - (targetPadding * normY);
    if (d.bayesBall)
      return 'M' + sourceX + ',' + sourceY + 'A' + dist + ',' + dist + ' 0 0,1 ' + targetX + ',' + targetY;
    else 
      return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
  });

  circle.attr('transform', function(d) {
    return 'translate(' + d.x + ',' + d.y + ')';
  });
}

// update graph (called when needed)
function restart() {
  // path (link) group
  path = path.data(links);

  // update existing links
  path.classed('selected', function(d) { return d === selected_link; })
    .classed('bayesBall', function(d) { return d.bayesBall; })
    .style('marker-end', function(d) { return d.bayesBall?'url(#end-arrow-bayesBall)':'url(#end-arrow)'; })
    .style('opacity', function(d) { return d.bayesBall?0.0:1.0; });
    //.style('marker-end', function(d) { return d.bayesBall?'':'url(#end-arrow)'; });

  // add new links
  path.enter().append('svg:path')
    .attr('class', 'link')
    .classed('selected', function(d) { return d === selected_link; })
    .classed('bayesBall', function(d) { return d.bayesBall; })
    .style('marker-end', function(d) { return d.bayesBall?'url(#end-arrow-bayesBall)':'url(#end-arrow)'; })
    .style('opacity', function(d) { return d.bayesBall?0.0:1.0; })
    //.style('marker-end', function(d) { return d.bayesBall?'':'url(#end-arrow)'; })
    .on('mousedown', function(d) {
      if(d3.event.keyCode === 77) return;

      // select link
      mousedown_link = d;
      if(mousedown_link === selected_link) selected_link = null;
      else selected_link = mousedown_link;
      selected_node = null;
      restart();
    });

  // remove old links
  path.exit().remove();

  // circle (node) group
  // NB: the function arg is crucial here! nodes are known by id, not by index!
  circle = circle.data(nodes, function(d) { return d.id; });

  // update existing nodes (observed & selected visual states)
  circle.selectAll('circle')
    .style('fill', function(d) { return (d.observed) ? "#de9ed6" : "#ffffff"; })
    .style('stroke-dasharray', function(d) {return (d === selected_node) ? '10,2':''; });

  // add new nodes
  var g = circle.enter().append('svg:g');

  g.append('svg:circle')
    .attr('class', 'node')
    .attr('r', 12)
    .style('fill', function(d) { return (d.observed) ? "#de9ed6" : "#ffffff"; })
    .style('stroke', function(d) { return "#000000"; })
    .style('stroke-dasharray', function(d) {return (d === selected_node) ? '10,2':''; })
    .on('mouseover', function(d) {
      if(!mousedown_node || d === mousedown_node) return;
      // enlarge target node
      d3.select(this).attr('transform', 'scale(1.3)');
    })
    .on('mouseout', function(d) {
      if(!mousedown_node || d === mousedown_node) return;
      // unenlarge target node
      d3.select(this).attr('transform', '');
    })
    .on('mousedown', function(d) {
      if(d3.event.keyCode === 77) return;

      // select node
      mousedown_node = d;
      if(mousedown_node === selected_node) setSelectedNode(null);
      else setSelectedNode(mousedown_node);
      selected_link = null;

      // reposition drag line
      drag_line
        .style('marker-end', 'url(#end-arrow)')
        .classed('hidden', false)
        .attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + mousedown_node.x + ',' + mousedown_node.y);

      restart();
    })
    .on('mouseup', function(d) {
      if(!mousedown_node) return;

      // needed by FF
      drag_line
        .classed('hidden', true)
        .style('marker-end', '');

      // check for drag-to-self
      mouseup_node = d;
      if(mouseup_node === mousedown_node) { resetMouseVars(); return; }

      // unenlarge target node
      d3.select(this).attr('transform', '');

      // add link to graph (update if exists)
      var source, target;
      source = mousedown_node;
      target = mouseup_node;

      var link;
      link = links.filter(function(l) {
        return ((l.source === source && l.target === target) || (l.source === target && l.target === source));
      })[0];

      if(!link) {
        // add link to model
        model.addEdge(mousedown_node.id, mouseup_node.id);
        link = {source: source, target: target};
        links.push(link);
      }

      // select new link
      selected_link = link;
      setSelectedNode(null);
      restart();
    });

  // show node IDs
  g.append('svg:text')
      .attr('x', 0)
      .attr('y', 4)
      .attr('class', 'id')
      .text(function(d) { return d.id; });

  // remove old nodes
  circle.exit().remove();

  // set the graph in motion
  force.start();
}

function mousedown() {
  // prevent I-bar on drag
  d3.event.preventDefault();
  
  // because :active only works in WebKit?
  svg.classed('active', true);

  if(d3.event.keyCode === 77 || mousedown_node || mousedown_link) return;

  // insert new node at point
  var point = d3.mouse(this),
      node = {id: ++lastNodeId, observed: false};
  node.x = point[0];
  node.y = point[1];
  nodes.push(node);

  // add state to model
  model.addState(false);

  restart();
}

function mousemove() {
  if(!mousedown_node || d3.event.keyCode == 77) return;

  // update drag line
  drag_line.attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + d3.mouse(this)[0] + ',' + d3.mouse(this)[1]);

  restart();
}

function mouseup() {
  if(mousedown_node) {
    // hide drag line
    drag_line
      .classed('hidden', true)
      .style('marker-end', '');
  }

  // because :active only works in WebKit?
  svg.classed('active', false);

  // clear mouse event vars
  resetMouseVars();
}

function removeLinkFromModel(link) {
  var sourceId = link.source.id,
      targetId = link.target.id;

  // remove edge
  model.removeEdge(sourceId, targetId);
}

function spliceLinksForNode(node) {
  var toSplice = links.filter(function(l) {
    return (l.source === node || l.target === node);
  });
  toSplice.map(function(l) {
    links.splice(links.indexOf(l), 1);
  });
}

// only respond once per keydown
var lastKeyDown = -1;

function keydown() {
  d3.event.preventDefault();

  if(lastKeyDown !== -1) return;
  lastKeyDown = d3.event.keyCode;

  // move
  if(d3.event.keyCode === 77) {
    circle.call(force.drag);
    svg.classed('move', true);
  }

  if(!selected_node && !selected_link) return;
  switch(d3.event.keyCode) {
    case 8: // backspace
    case 46: // delete
      if(selected_node) {
        model.removeState(selected_node.id);
        nodes.splice(nodes.indexOf(selected_node), 1);
        spliceLinksForNode(selected_node);
      } else if(selected_link) {
        removeLinkFromModel(selected_link);
        links.splice(links.indexOf(selected_link), 1);
      }
      selected_link = null;
      setSelectedNode(null);
      restart();
      break;
    case 79: // O(bserved)
      if(selected_node) {
        var observed = selected_node.observed;
        selected_node.observed = !observed;
        model.editStateObserved(selected_node.id);
      }
      restart();
      break;
    case 82: // R(everse)
      if(selected_link) {
        // change link direction
        var sourceId = selected_link.source.id,
            targetId = selected_link.target.id;
        model.removeEdge(sourceId, targetId);
        model.addEdge(targetId, sourceId);
        var temp = selected_link.source;
        selected_link.source = selected_link.target;
        selected_link.target = temp;
      }
      restart();
      break;
  }
}

function keyup() {
  lastKeyDown = -1;

  // move
  if(d3.event.keyCode === 77) {
    circle
      .on('mousedown.drag', null)
      .on('touchstart.drag', null);
    svg.classed('move', false);
  }
}

// app starts here
svg.on('mousedown', mousedown)
  .on('mousemove', mousemove)
  .on('mouseup', mouseup);
d3.select(window)
  .on('keydown', keydown)
  .on('keyup', keyup);
restart();