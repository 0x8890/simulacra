'use strict'

var processNodes = require('./process_nodes')
var keyMap = require('./key_map')

var isArray = Array.isArray
var hasBindingsKey = keyMap.hasBindings
var hasDefinitionKey = keyMap.hasDefinition
var markerKey = keyMap.marker
var replaceAttributeKey = keyMap.replaceAttribute
var isBoundToParentKey = keyMap.isBoundToParent

// Node names which should have value replaced.
var replaceValue = [ 'INPUT', 'TEXTAREA', 'PROGRESS' ]

// Input types which use the "checked" attribute.
var replaceChecked = [ 'checkbox', 'radio' ]

var retainElement = '__retain__' +
  ('00000000' + Math.floor(Math.random() * Math.pow(2, 32)).toString(16))
  .slice(-8)

// Upgrade to Symbol if possible, it guarantees uniqueness.
if (typeof Symbol === 'function') retainElement = Symbol(retainElement)

// Symbol for retaining an element instead of removing it.
Object.defineProperty(simulacra, 'retainElement', {
  enumerable: true, value: retainElement
})


module.exports = simulacra


/**
 * Bind an object to the DOM.
 *
 * @param {Object} obj
 * @param {Object} def
 * @return {Node}
 */
function simulacra (obj, def) {
  var document = this ? this.document : window.document
  var Node = this ? this.Node : window.Node
  var query

  if (typeof obj !== 'object' || isArray(obj))
    throw new TypeError('First argument must be a singular object.')

  if (obj[hasBindingsKey])
    throw new Error('Can not bind an object that is already bound.')

  if (!isArray(def))
    throw new TypeError('Second argument must be an array.')

  if (typeof def[0] === 'string') {
    query = def[0]
    def[0] = document.querySelector(query)
    if (!def[0]) throw new Error(
      'Top-level node "' + query + '" could not be found in the document.')
  }
  else if (!(def[0] instanceof Node)) throw new TypeError(
    'The first position of top-level must be a Node or a CSS selector string.')

  ensureNodes(this, def[0], def[1])
  Object.defineProperty(obj, hasBindingsKey, { value: true })

  return processNodes(this, def[0].cloneNode(true), def[1])
}


/**
 * Internal function to mutate string selectors into Nodes and validate that
 * they are allowed.
 *
 * @param {Object} [scope]
 * @param {Node} parentNode
 * @param {Object} def
 */
function ensureNodes (scope, parentNode, def) {
  var Element = scope ? scope.Element : window.Element
  var adjacentNodes = []
  var i, j, defKeys, key, query, branch, boundNode, ancestorNode

  if (typeof def !== 'object') throw new TypeError(
    'The second position must be an object.')

  defKeys = Object.keys(def)

  for (i = 0, j = defKeys.length; i < j; i++) {
    key = defKeys[i]

    if (!isArray(def[key]))
      def[key] = [ def[key] ]

    branch = def[key]

    // Internal value used while processing nodes.
    Object.defineProperty(branch, markerKey, { value: null, writable: true })

    if (typeof branch[0] === 'string') {
      query = branch[0]

      // May need to get the node above the parent, in case of binding to
      // the parent node.
      ancestorNode = parentNode.parentNode || parentNode

      branch[0] = ancestorNode.querySelector(query)
      if (!branch[0]) throw new Error(
        'The element for selector "' + query + '" was not found.')
    }
    else if (!(branch[0] instanceof Element))
      throw new TypeError('The first position on key "' + key +
        '" must be a DOM element or a CSS selector string.')

    boundNode = branch[0]

    if (typeof branch[1] === 'object' && branch[1] !== null) {
      Object.defineProperty(branch, hasDefinitionKey, { value: true })
      if (branch[2] && typeof branch[2] !== 'function')
        throw new TypeError('The third position on key "' + key +
          '" must be a function.')
    }
    else if (branch[1] && typeof branch[1] !== 'function')
      throw new TypeError('The second position on key "' + key +
        '" must be an object or a function.')

    // Special case for binding to parent node.
    if (parentNode === boundNode) {
      Object.defineProperty(branch, isBoundToParentKey, { value: true })
      if (branch[hasDefinitionKey]) ensureNodes(scope, boundNode, branch[1])
      else if (typeof branch[1] !== 'function')
        console.warn( // eslint-disable-line
          'A change function was not defined on the key "' + key + '".')
      continue
    }
    else adjacentNodes.push([ key, boundNode ])

    if (!parentNode.contains(boundNode))
      throw new Error('The bound DOM element must be either ' +
        'contained in or equal to the element in its parent binding.')

    if (branch[hasDefinitionKey]) {
      ensureNodes(scope, boundNode, branch[1])
      continue
    }

    Object.defineProperty(branch, replaceAttributeKey, {
      value: ~replaceValue.indexOf(boundNode.nodeName) ?
        ~replaceChecked.indexOf(boundNode.type) ?
        'checked' : 'value' : 'textContent'
    })
  }

  // Need to loop again to invalidate containment in adjacent nodes, after the
  // adjacent nodes are found.
  for (i = 0, j = defKeys.length; i < j; i++) {
    key = defKeys[i]
    boundNode = def[key][0]
    for (i = 0, j = adjacentNodes.length; i < j; i++)
      if (adjacentNodes[i][1].contains(boundNode) &&
        adjacentNodes[i][1] !== boundNode)
        throw new Error(
          'The element for key "' + key + '" is contained in the ' +
          'element for the adjacent key "' + adjacentNodes[i][0] + '".')
  }
}