/*
 * BBA v1.0.0
 * 
 * A library for Bayes Ball Algorithm.
 * 
 * Dependencies: Underscore.js
 *
 * Copyright (c) 2013 Charles Yuan Gao
 * Derived from Ross Kirsling's Model Logic Playground (http://github.com/rkirsling/modallogic)
 * Released under the MIT License.
 */
var BBA = (function() {
  'use strict';

  if(typeof _ !== 'function') throw new Error('BBA requires Underscore.js!');

  /**
   * Constructor for Kripke model. Takes no initial input.
   * @constructor
   */
  function Model() {
    // Array of states (worlds) in model.
    // Each state is an object with three properties:
    // - observed: whether the state is in the set of observations
    // - parents: an array of parents state indices
    // - children: an array of children state indices
    // ex: [{observed: true, parents: [0, 1], children: [3]},
    //      {observed: false, parents: [], children: []}]
    var _states = [];

    /**
     * Adds a state with a given observed property to the model.
     */
    this.addState = function(is_observed) {
      _states.push({observed: is_observed, parents: [], children: []});
    };

    /**
     * Removes a state and all related edges from the model, given a state index.
     */
    this.removeState = function(state) {
      if(!_states[state]) return;
      var self = this;

      while (_states[state].parents.length > 0){
        self.removeEdge(_states[state].parents[0], state);
      }

      while (_states[state].children.length > 0){
        self.removeEdge(state, _states[state].children[0]);
      }

      /*
      _(_states[state].parents).each(function(index){
        self.removeEdge(index, state);
      });

      _(_states[state].children).each(function(index){
        self.removeEdge(state, index);
      });
      */

      _states[state] = null;
    };

    /**
     * Returns the number of states in model.
     */
    this.numOfStates = function() {
      return _states.length;
    }

    /**
     * Adds an directed edge given source and target state indices.
     */
    this.addEdge = function(source, target) {
      if(!_states[source] || !_states[target]) return;

      _states[target].parents.push(source);
      _states[source].children.push(target);
    };

    /**
     * Removes an edge given source and target state indices.
     */
    this.removeEdge = function(source, target) {
      if(!_states[source]) return;

      var children = _states[source].children,
          index = _(children).indexOf(target);
      if(index !== -1) children.splice(index, 1);

      var parents = _states[target].parents;
          index = _(parents).indexOf(source);
      if(index !== -1) parents.splice(index, 1);
    };

    /**
     * Returns an array containing the observed property (or null) of each state in the model.
     */
    this.getStatesObservation = function() {
      var stateList = [];
      _(_states).each(function(state) {
        if(state) stateList.push(state.observed);
        else stateList.push(null);
      });

      return stateList;
    };

    /**
     * Returns an array of children states for a given state index.
     */
    this.getChildren = function(source) {
      if(!_states[source]) return undefined;
      return _states[source].children; 
    };

    /**
     * Returns an array of parents states for a given state index.
     */
    this.getParents = function(source) {
      if(!_states[source]) return undefined;
      return _states[source].parents; 
    };

    /**
     * Edits the observation property of a state in the model given a state index.
     */
    this.editStateObserved = function(state) {
      if(!_states[state]) return;

      var observed = _states[state].observed;
      _states[state].observed = !observed;
    }


    /**
     * Returns current model as a compact string suitable for use as a URL parameter.
     * ex. OFC1,2 meaning: observed = false, children = 1,2
     */
    this.getModelString = function() {
      var modelString = '';

      _(_states).each(function(state) {
        if(state) {
          modelString += (state.observed)?'OT':'OF';
          modelString += 'C' + state.children.join();
        }
        modelString += ';';
      });

      return modelString;
    };

    /**
     * Restores a model from a given model string.
     */
    this.loadFromModelString = function(modelString) {
      var regex = /^(?:;|(?:O|O[FT])(?:C|C(?:\d+,)*\d+);)+$/;
      if(!regex.test(modelString)) return;
      
      _states = [];

      var self = this,
          childrenLists = [],
          inputStates = modelString.split(';').slice(0, -1);

      // restore states
      _(inputStates).each(function(state) {
        if(!state) {
          _states.push(null);
          childrenLists.push(null);
          return;
        }

        var stateProperties = _(state.match(/O(.*)C(.*)/).slice(1, 3))
                                     .map(function(substr) { return (substr ? substr.split(',') : []); });

        var observed = (stateProperties[0][0] === 'T');
        _states.push({observed: observed, parents: [], children: []});

        var children = _(stateProperties[1]).map(function(childState) { return +childState; });
        childrenLists.push(children);
      });

      // restore edges
      _(childrenLists).each(function(children, source) {
        if(!children) return;

        _(children).each(function(target) {
          self.addEdge(source, target);
        });
      });
    };
  }

  /**
   * Depth-first search from a state in model, as a helper function for topologicalSort.
   * @private
   */
  function _visit(model, state, markTemp, markPerm) {
    if (markTemp[state]) return false; // not a DAG
    if (!markPerm[state]){
      markTemp[state] = true;
      var children = model.getChildren(state);
      if (children)
        for (var i = 0; i < children.length; i ++)
          if (!_visit(model, children[i], markTemp, markPerm))
            return false;
      markTemp[state] = false;
      markPerm[state] = true;
    }
    return true;
  }

  /**
   * Topological sort on the graph to check model validity (whether it is a directed acyclic graph).
   * @private
   */
  function _topologicalSort(model) {
    var markTemp = [], markPerm = [];
    for (var i = 0; i < model.numOfStates(); i ++)
      if (!markPerm[i] && !_visit(model, i, markTemp, markPerm)) // not a DAG
          return false;
    return true; // valid graph
  }

  /**
   * Run the Bayes Ball Algorithm.
   * Check all the nodes that are conditionally dependent of the given node.
   * Return a playQueue containing the node visited by the algorithm in order.
   */
  function bayesBall(model, source) {
    if (!_topologicalSort(model)) return null; // invalid model
    var observed = model.getStatesObservation();
    var queue = [],
        playQueue = [];
    var visited = new Array(observed.length);
    for (var i = 0; i < observed.length; i ++) visited[i] = new Array(observed.length);
    var node = {from: -1, to: source, from_child: true};
    queue.push(node);
    while(queue.length > 0){
      node = queue.shift();
      playQueue.push(node);
      if ( (node.from_child && !observed[node.to]) || (!node.from_child && observed[node.to]) ){
        // visit all parents
        var parents = model.getParents(node.to);
        for (var i = 0; i < parents.length; i ++){
          var temp = parents[i];
          if (!visited[node.to][temp]){
            queue.push({from: node.to, to: temp, from_child: true});
            visited[node.to][temp] = true;
          }
        }
      }
      if (!observed[node.to]){
        // visit all children
        var children = model.getChildren(node.to);
        for (var i = 0; i < children.length; i ++){
          var temp = children[i];
          if (!visited[node.to][temp]){
            queue.push({from: node.to, to: temp, from_child: false});
            visited[node.to][temp] = true;
          }
        }
      }
    }
    return playQueue;
  }

  // export public methods
  return {
    Model: Model,
    bayesBall: bayesBall
  };

})();
