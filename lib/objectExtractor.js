const ut = require('./util.js')
const json2moExpression = require('../json2mo/expression.js')

// TODO: change structure to put all instances in "defined_instances" keyword

/*
{
    "instances": {
      "instance_a": {
        "type": "element",
        "type_specifier": "...",
        "type_prefix": "...",
        "annotation": {},
        "class_modification": {},
        "long_class_specifier_identifier": "..."
      },
      ...
    },
    "requiredReferences": {
        "extends_clause": [
            {
                "name": ...,
                "long_class_specifier_identifier": ..
                "class_modification": {},
                "annotation": {}
            }
        ],
        "import_clause": [
            {
                ...
            }
        ],
        "connections": {
          "instance_a": ["instance_b", "instance_c", ...],
          "instance_b": [...]
        }
    }
}

*/
function updateRequiredReferences (requiredReferences, newRequiredReferences) {
  if (newRequiredReferences !== null && newRequiredReferences !== undefined) {
    if ('extends_clause' in newRequiredReferences) {
      if ('extends_clause' in requiredReferences) {
        requiredReferences.extends_clause = requiredReferences.extends_clause.concat(newRequiredReferences.extends_clause)
      } else {
        requiredReferences.extends_clause = newRequiredReferences.extends_clause.concat([])
      }
    }
    if ('import_clause' in newRequiredReferences) {
      if ('import_clause' in requiredReferences) {
        requiredReferences.import_clause = requiredReferences.import_clause.concat(newRequiredReferences.import_clause)
      } else {
        requiredReferences.import_clause = newRequiredReferences.import_clause.concat([])
      }
    }
    if ('connections' in newRequiredReferences) {
      if ('connections' in requiredReferences) {
        requiredReferences.connections = updateConnections(requiredReferences.connections, newRequiredReferences.connections)
      } else {
        requiredReferences.connections = Object.assign({}, newRequiredReferences.connections)
      }
    }
    // Only present when a loop connect could not be mapped, so the objects
    // JSON of every other class is unchanged.
    if ('unsupportedConnectLoops' in newRequiredReferences && newRequiredReferences.unsupportedConnectLoops.length > 0) {
      requiredReferences.unsupportedConnectLoops = (requiredReferences.unsupportedConnectLoops || []).concat(newRequiredReferences.unsupportedConnectLoops)
    }
    if ('passthroughEquations' in newRequiredReferences && newRequiredReferences.passthroughEquations.length > 0) {
      requiredReferences.passthroughEquations = (requiredReferences.passthroughEquations || []).concat(newRequiredReferences.passthroughEquations)
    }
  }
  return requiredReferences
}

function updateConnections (connections, newConnections) {
  if (newConnections !== null && newConnections !== undefined) {
    for (const element in newConnections) {
      if (!(element in connections)) {
        connections[element] = newConnections[element].concat([])
      } else {
        newConnections[element].forEach(connectedElement => {
          if (!(connectedElement in connections[element])) {
            connections[element] = connections[element].concat([connectedElement])
          }
        })
      }
    }
  }
  return connections
}

function extractAllObjects (jsonOutput, within = null, mode = 'cdl') {
  let instances = {}
  let requiredReferences = {}
  if (within === null) {
    if (jsonOutput.within === null || jsonOutput.within === undefined) {
      within = null
    } else {
      within = jsonOutput.within
    }
  }
  const fullMoFilePath = jsonOutput.fullMoFilePath

  const classDefinitions = jsonOutput.stored_class_definitions
  for (let i = 0; i < classDefinitions.length; i++) {
    let longClassSpecifier = null
    let shortClassSpecifier = null
    let derClassSpecifier = null
    let identifier = null

    const classDefinition = classDefinitions[i]
    const classSpecifier = classDefinition.class_specifier
    const classPrefixes = classDefinition.class_prefixes
    if ('long_class_specifier' in classSpecifier) {
      longClassSpecifier = classSpecifier.long_class_specifier
      const newAllObjects = extractFromLongClassSpecifier(longClassSpecifier, fullMoFilePath, classPrefixes, within)
      instances = Object.assign({}, instances, newAllObjects.instances)
      requiredReferences = updateRequiredReferences(requiredReferences, newAllObjects.requiredReferences)
    }
    if ('short_class_specifier' in classSpecifier) {
      shortClassSpecifier = classSpecifier.short_class_specifier
      identifier = shortClassSpecifier.identifier
      const shortClassSpeciiferValue = shortClassSpecifier.value
      let name = null

      if ('name' in shortClassSpeciiferValue && shortClassSpeciiferValue.name !== undefined) {
        name = shortClassSpeciiferValue.name
        instances[identifier] = {
          type: 'short_class_specifier',
          type_specifier: name,
          short_class_specifier_value: shortClassSpeciiferValue,
          within,
          fullMoFilePath,
          description: shortClassSpeciiferValue.description
        }
      }
      if ('enum_list' in shortClassSpeciiferValue && shortClassSpeciiferValue.enum_list !== undefined) {
        instances[identifier] = {
          type: 'enumeration_class',
          type_specifier: name,
          short_class_specifier_value: shortClassSpeciiferValue,
          within,
          fullMoFilePath,
          description: shortClassSpeciiferValue.description
        }
        const enumList = shortClassSpeciiferValue.enum_list

        for (let j = 0; j < enumList.length; j++) {
          const enumListIdentifier = enumList[j].identifier
          instances[enumListIdentifier] = {
            type: 'enumeration',
            description: enumList[j].description,
            enumeration_literal: enumList[j],
            enumeration_kind: identifier
          }
        }
      }
    }
    if ('der_class_specifier' in classSpecifier && classSpecifier.der_class_specifier !== undefined) {
      derClassSpecifier = classSpecifier.der_class_specifier
      identifier = derClassSpecifier.identifier
      const derClassSpeciiferValue = derClassSpecifier.value
      instances[identifier] = {
        type: 'der_class_specifier',
        value: derClassSpeciiferValue,
        within,
        fullMoFilePath
      }
    }
  }
  const allObjects = { instances, requiredReferences }
  return allObjects
}

function extractFromLongClassSpecifier (longClassSpecifier, fullMoFilePath, classPrefixes = null, within = null) {
  let instances = {}
  let requiredReferences = {}
  let identifier = null
  let composition = null
  let compositionInstances = {}
  let compositionRequiredReferences = {}
  const dictIdentifier = {}
  dictIdentifier.within = within
  dictIdentifier.fullMoFilePath = fullMoFilePath

  if ('identifier' in longClassSpecifier) {
    identifier = longClassSpecifier.identifier
    dictIdentifier.type = 'long_class_specifier'
  }

  // The class comment — `block AT "Aggregation block for multiple inputs"`.
  // A component carries its comment nested under `description`, and that path
  // is already extracted below; a class carries it directly on the
  // long_class_specifier, so without this it is dropped here and never
  // reaches the CXF emitter.
  if ('description_string' in longClassSpecifier && longClassSpecifier.description_string !== undefined) {
    dictIdentifier.description_string = longClassSpecifier.description_string
  }

  if (classPrefixes !== null) {
    dictIdentifier.class_prefixes = classPrefixes
  }

  if (longClassSpecifier.extends !== null && longClassSpecifier.extends !== undefined) {
    dictIdentifier.extends = true
    if ('class_modification' in longClassSpecifier && longClassSpecifier.class_modification !== undefined) {
      // classModification = longClassSpecifier.classModification
      // TODO: handle later
    }
  }
  if ('composition' in longClassSpecifier && longClassSpecifier.composition !== undefined) {
    composition = longClassSpecifier.composition
    const newAllObjects = extractFromComposition(composition, identifier, fullMoFilePath, within)
    compositionInstances = Object.assign({}, compositionInstances, newAllObjects.instances)
    compositionRequiredReferences = updateRequiredReferences(compositionRequiredReferences, newAllObjects.requiredReferences)

    if ('annotation' in composition && composition.annotation !== undefined) {
      dictIdentifier.annotation = composition.annotation
      dictIdentifier.semantics = extractSemanticsFromAnnotations(composition.annotation, identifier)
      dictIdentifier.cdl_annotations = extractCdlAnnotations(composition.annotation)
    }
  }
  if (identifier !== null) {
    instances[identifier] = dictIdentifier
  }
  if (compositionInstances.length !== 0) {
    instances = Object.assign({}, instances, compositionInstances)
  }
  requiredReferences = updateRequiredReferences(requiredReferences, compositionRequiredReferences)
  const allObjects = { instances, requiredReferences }
  return allObjects
}

function extractFromComposition (composition, longClassSpecifierIdentifier, fullMoFilePath, within) {
  let elementSections = null
  let instances = {}
  let requiredReferences = {}
  let newAllObjects = null

  if (composition === null || composition === undefined) {
    return { instances: {}, requiredReferences: {} }
  }

  if ('element_list' in composition && composition.element_list !== undefined) {
    const elementList = composition.element_list
    // TODO: check with jianjun
    newAllObjects = extractFromElementList(elementList, longClassSpecifierIdentifier, fullMoFilePath, within, 'public')
    instances = Object.assign({}, instances, newAllObjects.instances)
    requiredReferences = updateRequiredReferences(requiredReferences, newAllObjects.requiredReferences)
  }

  if ('element_sections' in composition && composition.element_sections !== undefined) {
    elementSections = composition.element_sections
    for (let i = 0; i < elementSections.length; i++) {
      const elementSection = elementSections[i]
      if ('public_element_list' in elementSection && elementSection.public_element_list !== undefined) {
        const publicElementList = elementSection.public_element_list
        newAllObjects = extractFromElementList(publicElementList, longClassSpecifierIdentifier, fullMoFilePath, within, 'public')
        instances = Object.assign({}, instances, newAllObjects.instances)
        requiredReferences = updateRequiredReferences(requiredReferences, newAllObjects.requiredReferences)
      }
      if ('protected_element_list' in elementSection && elementSection.protected_element_list !== undefined) {
        const protectedElementList = elementSection.protected_element_list
        newAllObjects = extractFromElementList(protectedElementList, longClassSpecifierIdentifier, fullMoFilePath, within, 'protected')
        instances = Object.assign({}, instances, newAllObjects.instances)
        requiredReferences = updateRequiredReferences(requiredReferences, newAllObjects.requiredReferences)
      }
      if ('equation_section' in elementSection && elementSection.equation_section !== undefined) {
        const equationSection = elementSection.equation_section
        const extracted = extractConnectionsFromEquationSection(equationSection, instances)
        // An elementary CDL block's equations define the block; only a
        // composite's `y = u` is a wire. Keep elementary objects JSON as is.
        const qualifiedName = (within !== undefined && within !== null && within.length > 0 ? within + '.' : '') + longClassSpecifierIdentifier
        const isElementary = ut.checkIfCdlElementaryBlockOrPackage(qualifiedName, true)
        const newRequiredReferences = {
          connections: extracted.connections,
          unsupportedConnectLoops: extracted.unsupportedConnectLoops,
          passthroughEquations: isElementary ? [] : extracted.passthroughEquations
        }
        requiredReferences = updateRequiredReferences(requiredReferences, newRequiredReferences)
      }
    }
  }

  if ('external_composition' in composition && composition.external_composition !== undefined) {
    // TODO:
  }
  const allObjects = { instances, requiredReferences }
  return allObjects
}

function extractFromElementList (elementList, longClassSpecifierIdentifier, fullMoFilePath, within, compositionSpecifier) {
  let instances = {}
  let requiredReferences = {}

  for (let i = 0; i < elementList.length; i++) {
    const element = elementList[i]

    if ('extends_clause' in element && element.extends_clause !== undefined) {
      const extendsClause = element.extends_clause
      if (longClassSpecifierIdentifier !== null) {
        extendsClause.long_class_specifier_identifier = longClassSpecifierIdentifier
        extendsClause.within = within
        extendsClause.compositionSpecifier = compositionSpecifier
      }

      if ('extends_clause' in requiredReferences) {
        requiredReferences.extends_clause = requiredReferences.extends_clause.concat([extendsClause])
      } else {
        requiredReferences.extends_clause = [extendsClause]
      }
    }
    if ('import_clause' in element && element.import_clause !== undefined) {
      const importClause = element.import_clause
      if (longClassSpecifierIdentifier !== null) {
        importClause.long_class_specifier_identifier = longClassSpecifierIdentifier
        importClause.within = within
        importClause.compositionSpecifier = compositionSpecifier
      }
      if ('import_clause' in requiredReferences) {
        requiredReferences.import_clause = requiredReferences.import_clause.concat([importClause])
      } else {
        requiredReferences.import_clause = [importClause]
      }
    }
    if ('class_definition' in element && element.class_definition !== undefined) {
      const classDefinitionInstance = {}
      const classSpecifier = element.class_definition.class_specifier
      const classPrefixes = element.class_definition.class_prefixes
      let identifier2 = null
      const dict = {
        within,
        fullMoFilePath,
        classPrefixes,
        compositionSpecifier
      }
      if ('long_class_specifier' in classSpecifier) {
        dict.type = 'long_class_specifier'
        identifier2 = classSpecifier.long_class_specifier.identifier
        dict.annotation = classSpecifier.long_class_specifier.composition.annotation
        dict.semantics = extractSemanticsFromAnnotations(dict.annotation, identifier2)
        dict.cdl_annotations = extractCdlAnnotations(dict.annotation)

        classDefinitionInstance[identifier2] = dict
      } else if ('short_class_specifier' in classSpecifier) {
        // TODO: handle
      }
      // var jsonOp = {'class_definition': [element.class_definition], 'within': within, 'fullMoFilePath': fullMoFilePath}
      // var newAllObjects = extractAllObjects(jsonOp, within=within)
      instances = Object.assign({}, instances, classDefinitionInstance)
      requiredReferences = updateRequiredReferences(requiredReferences, {})
    }
    if ('component_clause' in element && element.component_clause !== undefined) {
      const componentClause = element.component_clause
      let typePrefix = null
      let typeSpecifier = null
      let arraySubscripts = null
      let constrainingClause = null
      let replaceable = null
      let isFinal = null
      const componentList = componentClause.component_list

      typePrefix = componentClause.type_prefix
      typeSpecifier = ut.resolveTypeSpecifier(componentClause.type_specifier, within, fullMoFilePath)
      arraySubscripts = componentClause.array_subscripts

      if ('constraining_clause' in element && element.constraining_clause !== undefined) {
        constrainingClause = element.constraining_clause
      }
      if ('replaceable' in element && element.replaceable !== undefined) {
        replaceable = element.replaceable
      }
      // `final parameter Real k = ...`. The keyword sits on the element,
      // beside `replaceable`, and distinguishes a derived value the caller
      // cannot override from a settable default. Without it a consumer has to
      // recover the flag from the AST, which the CXF alone should not require.
      if ('final' in element && element.final !== undefined) {
        isFinal = element.final
      }

      for (let i = 0; i < componentList.length; i++) {
        const singleComponentList = componentList[i]
        const identifier = singleComponentList.declaration.identifier
        let annotation = null

        if ('description' in singleComponentList && singleComponentList.description !== undefined) {
          if ('annotation' in singleComponentList.description && singleComponentList.description.annotation !== undefined) {
            annotation = singleComponentList.description.annotation
          }
        }
        let isVector = false
        let singleComponentArraySubscripts = ''
        if ('array_subscripts' in singleComponentList.declaration && singleComponentList.declaration.array_subscripts !== undefined) {
          isVector = true
          singleComponentArraySubscripts = parseArraySubscripts(singleComponentList.declaration.array_subscripts)
        }
        instances[identifier] = {
          type_prefix: typePrefix,
          type_specifier: typeSpecifier,
          array_subscripts: arraySubscripts,
          type: 'element',
          compositionSpecifier,
          long_class_specifier_identifier: longClassSpecifierIdentifier,
          single_component_list: singleComponentList,
          annotation,
          semantics: extractSemanticsFromAnnotations(annotation, identifier),
          cdl_annotations: extractCdlAnnotations(annotation),
          isVector,
          arraySubscripts: singleComponentArraySubscripts,
          replaceable,
          final: isFinal,
          constraining_clause: constrainingClause,
          within,
          fullMoFilePath
        }
      }
    }
  }
  const allObjects = { instances, requiredReferences }
  return allObjects
}

function extractConnectionsFromEquationSection (equationSection, instances) {
  const connections = {}
  const unsupportedConnectLoops = []
  const passthroughEquations = []
  const equations = ('equation' in equationSection && equationSection.equation !== undefined)
    ? equationSection.equation
    : []
  equations.forEach(equation => {
    if ('connect_clause' in equation && equation.connect_clause !== undefined) {
      addConnection(connections, parseComponentReference(equation.connect_clause.from), parseComponentReference(equation.connect_clause.to))
    } else if ('for_equation' in equation && equation.for_equation !== undefined) {
      collectForLoopConnections(equation.for_equation, instances || {}, connections, unsupportedConnectLoops, false)
    } else if ('assignment_equation' in equation && equation.assignment_equation !== undefined) {
      const passthrough = passthroughOf(equation.assignment_equation, instances || {})
      if (passthrough !== null) passthroughEquations.push(passthrough)
    }
  })
  return { connections, unsupportedConnectLoops, passthroughEquations }
}

const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/
const connectorTypePattern = /\.Interfaces\.(Real|Integer|Boolean)(Input|Output)$/

/**
 * `lhs = rhs` where both sides are bare identifiers of connector instances
 * of this class is a connection between them. Anything else (an
 * expression, a parameter such as `y = k`, an indexed element) is not.
 *
 * A Modelica equation is acausal: `u = y` and `y = u` are the same equation.
 * The edge therefore runs from the input into the output whichever side
 * each is written on. When both sides are the same kind (`y2 = y1`), the
 * right-hand side feeds the left-hand side.
 *
 * @param assignment simplified `assignment_equation`: `{ lhs, rhs }`
 * @param instances the class's instance dictionary, name → declaration
 * @returns {{from: string, to: string}|null}
 */
function passthroughOf (assignment, instances) {
  const lhs = typeof assignment.lhs === 'string' ? assignment.lhs.trim() : null
  const rhsNode = assignment.rhs
  const rhs = rhsNode !== undefined && rhsNode !== null && typeof rhsNode.simple_expression === 'string'
    ? rhsNode.simple_expression.trim()
    : null
  if (lhs === null || rhs === null) return null
  if (!identifierPattern.test(lhs) || !identifierPattern.test(rhs)) return null
  const kindOf = name => {
    const instance = instances[name]
    if (instance === undefined || typeof instance.type_specifier !== 'string') return null
    const match = connectorTypePattern.exec(instance.type_specifier)
    return match === null ? null : match[2]
  }
  const lhsKind = kindOf(lhs)
  const rhsKind = kindOf(rhs)
  if (lhsKind === null || rhsKind === null) return null
  if (lhsKind === 'Input' && rhsKind === 'Output') return { from: lhs, to: rhs }
  return { from: rhs, to: lhs }
}

function addConnection (connections, from, to) {
  if (from in connections) {
    if (!connections[from].includes(to)) {
      connections[from] = connections[from].concat([to])
    }
  } else {
    connections[from] = [to]
  }
}

/**
 * Map the connect equations of one for loop to wholesale connections.
 *
 * CXF has no term for a loop, so a loop connect can only be written when it
 * is exactly `connect(a, b)` over two whole arrays: the range is `1:<hi>`,
 * each side subscripts exactly one array by the bare loop index, and an
 * array instance subscripted that way is declared with dimension `<hi>`
 * (compared as text, whitespace removed), so the loop covers all of it. The
 * index is then dropped on both sides. A side that subscripts a PORT
 * (`mulSum.u[i]`) is accepted as is: the port's size lives in the block
 * class, which this parser does not see; the consumer checks it. Any other
 * loop that contains a connect is recorded in `unsupported`, with the
 * reason, so that the CXF exporter can refuse the class instead of silently
 * dropping an edge. Equations in the loop body that are not connects are
 * not connections and are left alone, as they are outside a loop.
 *
 * @param forEquation simplified `for_equation`: `{ for_indices, loop_equations }`
 * @param instances the class's instance dictionary, name → declaration
 * @param connections the class's connection map, extended in place
 * @param unsupported list of reasons, extended in place
 * @param nested true when this loop sits inside another loop
 */
function collectForLoopConnections (forEquation, instances, connections, unsupported, nested) {
  const loopEquations = forEquation.loop_equations || []
  const connects = loopEquations.filter(e => 'connect_clause' in e && e.connect_clause !== undefined)
  const inner = loopEquations.filter(e => 'for_equation' in e && e.for_equation !== undefined)
  inner.forEach(e => collectForLoopConnections(e.for_equation, instances, connections, unsupported, true))
  if (connects.length === 0) return

  const indices = forEquation.for_indices || []
  const range = indices.length === 1 && indices[0].expression !== undefined && indices[0].expression !== null
    ? String(indices[0].expression.simple_expression !== undefined ? indices[0].expression.simple_expression : '')
    : ''
  const describe = () => connects.map(e => `connect(${parseComponentReference(e.connect_clause.from)}, ${parseComponentReference(e.connect_clause.to)})`).join('; ')

  if (nested || indices.length !== 1) {
    unsupported.push(`${describe()}: nested or multi-index for loop`)
    return
  }
  const index = indices[0].identifier
  const rangeMatch = /^\s*(\S+)\s*:\s*(.+?)\s*$/.exec(range)
  if (rangeMatch === null || rangeMatch[1] !== '1' || rangeMatch[2].includes(':')) {
    unsupported.push(`${describe()}: loop range '${range}' lower bound is not 1 or has a step`)
    return
  }
  const hi = rangeMatch[2]

  connects.forEach(e => {
    const from = parseComponentReference(e.connect_clause.from)
    const to = parseComponentReference(e.connect_clause.to)
    const fromWhole = wholesaleName(from, index, hi, instances)
    const toWhole = wholesaleName(to, index, hi, instances)
    if (typeof fromWhole !== 'string' || typeof toWhole !== 'string') {
      const reason = typeof fromWhole !== 'string' ? fromWhole.reason : toWhole.reason
      unsupported.push(`connect(${from}, ${to}): ${reason}`)
      return
    }
    addConnection(connections, fromWhole, toWhole)
  })
}

/**
 * Drop the one `[index]` subscript from a component reference, or explain
 * why that is not possible.
 *
 * @param name component reference text, e.g. `gai[i].u` or `mulSum.u[i]`
 * @param index the loop index identifier
 * @param hi the range's upper bound text, e.g. `n` or `n-1`
 * @param instances the class's instance dictionary (for declared dimensions)
 * @returns {string|{reason: string}} the wholesale name, or a reason
 */
function wholesaleName (name, index, hi, instances) {
  const subscripts = name.match(/\[[^\]]*\]/g) || []
  if (subscripts.length === 0) {
    return { reason: `'${name}' does not use the loop index` }
  }
  if (subscripts.length > 1) {
    return { reason: `'${name}' has more than one subscript` }
  }
  const content = subscripts[0].slice(1, -1).trim()
  if (content !== index) {
    return { reason: `'${name}' uses a derived index '${content}'` }
  }
  // Subscript on the first segment: an array instance (or connector array)
  // of this class. Its declared dimension must be the range's upper bound,
  // or the loop covers only part of the array.
  const firstSegment = name.split('.')[0]
  if (firstSegment.endsWith(subscripts[0])) {
    const instanceName = firstSegment.slice(0, -subscripts[0].length)
    const declared = instances[instanceName] !== undefined && typeof instances[instanceName].arraySubscripts === 'string'
      ? instances[instanceName].arraySubscripts
      : ''
    const squeeze = s => s.replace(/\s+/g, '')
    if (squeeze(declared) !== squeeze(`[${hi}]`)) {
      return { reason: `range 1:${hi} does not cover '${instanceName}' declared ${declared || 'as a scalar'}` }
    }
  }
  return name.replace(subscripts[0], '')
}

function parseComponentReference (reference) {
  let name = ''
  reference.forEach(namePart => {
    if (namePart.dot_op === true) {
      name = name + '.'
    }

    if (namePart.identifier !== undefined && namePart.identifier !== null) {
      name = name + namePart.identifier
    }
    if (namePart.array_subscripts !== undefined && namePart.array_subscripts !== null) {
      name = name + parseArraySubscripts(namePart.array_subscripts)
    }
  })
  return name
}

function parseArraySubscripts (arraySubscripts) {
  let arraySubscriptsString = ''
  if (arraySubscripts !== undefined && arraySubscripts !== null && arraySubscripts.length !== 0) {
    arraySubscripts.forEach(subscript => {
      if (subscript !== undefined) {
        if ('colon_op' in subscript && subscript.colon_op !== undefined && subscript.colon_op) {
          arraySubscriptsString += ':'
        }
        if ('expression' in subscript && subscript.expression !== undefined) {
          if ('simple_expression' in subscript.expression && subscript.expression.simple_expression !== undefined) {
            arraySubscriptsString += subscript.expression.simple_expression
          } else {
            arraySubscriptsString += json2moExpression.parse(subscript.expression)
          }
        }
        arraySubscriptsString += ','
      }
    })
    if (arraySubscriptsString !== '') {
      arraySubscriptsString = arraySubscriptsString.slice(0, -1)
      arraySubscriptsString = '[' + arraySubscriptsString + ']'
    }
    return arraySubscriptsString
  } else {
    return ''
  }
}

/**
 * Parses *class* modifications and constructs an output dictionary.
 *
 * - Direct assignments (such as in parameter declarations) are not returned.
 *
 * @param {Object} modifications The modifications object to parse.
 * @param {function} [stringifyExpression=] Function to convert expression
 *     objects into Modelica expressions (strings).
 * @returns {Object} The parsed modifications as a dictionary.
 */
function parseModifications (modifications, stringifyExpression) {
  let outputDict = {}
  if (Object.keys(modifications).length > 0) {
    Object.keys(modifications).forEach(modificationKey => {
      const classModifications = modifications[modificationKey]
      if (classModifications?.length > 0) {
        classModifications.forEach(classModification => {
          const eleMod = classModification.element_modification_or_replaceable.element_modification
          const eleKey = eleMod.name
          const eleDict = {}
          const mod = eleMod.modification
          if (mod.expression !== undefined) {
            if (stringifyExpression != null) {
              eleDict[eleKey] = stringifyExpression(mod.expression)
            } else {
              eleDict[eleKey] = mod.expression.simple_expression || mod.expression.if_expression
            }
          } else {
            eleDict[eleKey] = parseModifications(mod, stringifyExpression)
          }
          if (eleKey !== 'propagate') {
            outputDict = Object.assign({}, outputDict, eleDict)
          } else {
            if (outputDict.propagate === undefined) {
              outputDict.propagate = [eleDict[eleKey]]
            } else {
              const existingPropagateList = outputDict.propagate
              existingPropagateList.push(eleDict[eleKey])
              outputDict.propagate = existingPropagateList
            }
          }
        })
      }
    })
  }
  return outputDict
}

function extractCdlAnnotations (annotation) {
  let cdlAnnotations = {}
  if (annotation !== null && annotation !== undefined) {
    annotation.forEach(singleAnnotation => {
      const annotationName = singleAnnotation.element_modification_or_replaceable.element_modification.name
      if (annotationName === '__cdl' || annotationName === '__Buildings') {
        const modifications = singleAnnotation.element_modification_or_replaceable.element_modification.modification
        cdlAnnotations = parseModifications(modifications)
      }
    })
  }
  return cdlAnnotations
}

function extractSemanticsFromAnnotations (annotation, instanceIdentifier) {
  const semantics = {}
  if (annotation !== null && annotation !== undefined) {
    annotation.forEach(singleAnnotation => {
      const annotationName = singleAnnotation.element_modification_or_replaceable.element_modification.name
      if (annotationName === '__cdl' || annotationName === '__Buildings') {
        const classModifications = singleAnnotation.element_modification_or_replaceable.element_modification.modification.class_modification
        classModifications.forEach(classModification => {
          const keyName = classModification.element_modification_or_replaceable.element_modification.name
          if (keyName === 'semantic') {
            const semanticClassModifications = classModification.element_modification_or_replaceable.element_modification.modification.class_modification
            semanticClassModifications.forEach(semanticClassModification => {
              const semanticLanguageKey = semanticClassModification.element_modification_or_replaceable.element_modification.name
              let semanticLanguage = semanticClassModification.element_modification_or_replaceable.element_modification.modification.expression.simple_expression
              const semanticLanguageContent = semanticClassModification.element_modification_or_replaceable.element_modification.description_string
              semanticLanguage = semanticLanguage.split('"')[1]
              // semanticLanguageContent = semanticLanguageContent.replaceAll('<cdl_instance_name>', instanceIdentifier)
              if (semanticLanguageKey === 'metadataLanguageDefinition' || semanticLanguageKey === 'naturalLanguageDefinition') {
                if (!(semanticLanguage in semantics)) {
                  semantics[semanticLanguage] = ''
                }
              } else if (semanticLanguageKey === 'metadataLanguage' || semanticLanguageKey === 'naturalLanguage') {
                if (semanticLanguage in semantics) {
                  semantics[semanticLanguage] = semantics[semanticLanguage] + semanticLanguageContent + '\n'
                } else {
                  semantics[semanticLanguage] = semanticLanguageContent + '\n'
                }
              }
            })
          }
        })
      }
    })
  }

  return semantics
}

module.exports.extractAllObjects = extractAllObjects
module.exports.updateConnections = updateConnections
module.exports.updateRequiredReferences = updateRequiredReferences
module.exports.extractSemanticsFromAnnotations = extractSemanticsFromAnnotations
module.exports.parseModifications = parseModifications
