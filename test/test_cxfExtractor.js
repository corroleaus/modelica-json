'use strict'
const as = require('assert')
const mo = require('mocha')
const path = require('path')
const fs = require('fs')
const pa = require('../lib/parser')
const ut = require('../lib/util')
const ce = require('../lib/cxfExtractor.js')

mo.describe('cxfExtractor.js', function () {
  // The ModelicaMode package lives under test/. Its classes are referenced by
  // fully-qualified name (e.g. ModelicaMode.VAVBox); getMoFiles resolves them via
  // the modelica-json directory that getMODELICAPATH already prepends, so no
  // MODELICAPATH change is needed. The objects JSON used by the validation
  // helpers is generated below in 'modelica' mode.
  const templatesDir = path.join(__dirname, 'ModelicaMode')
  const baseClass = 'ModelicaMode.VAVBox'
  const instanceName = 'ctl'
  const directory = process.cwd()

  mo.before(function () {
    const files = [
      path.join(templatesDir, 'VAVBoxCoolingOnly.mo'),
      path.join(templatesDir, 'VAVBoxCoolingOnlyOpenLoop.mo'),
      path.join(templatesDir, 'VAVBoxCoolingOnlyInvalid.mo'),
      path.join(templatesDir, 'BadController.mo')
    ]
    pa.getJsons(files, 'cxf', 'current', true, false, false, 'modelica')
  })

  mo.after(function () {
    for (const d of ['objects', 'json', 'cxf']) {
      const p = path.join(process.cwd(), d)
      if (fs.existsSync(p)) {
        ut.removeDir(p)
      }
    }
  })

  mo.describe('getConstrainingType(baseClass, instanceName, directory)', function () {
    mo.it('returns the constrainedby type of a replaceable component', function () {
      const constrainingType = ce.getConstrainingType(baseClass, instanceName, directory)
      as.equal(constrainingType, 'ModelicaMode.PartialController')
    })
  })

  mo.describe('isSubtype(redeclaredType, constrainingType, directory)', function () {
    mo.it('returns true for a structural subtype', function () {
      as.ok(ce.isSubtype('ModelicaMode.G36VAVBoxCoolingOnly', 'ModelicaMode.PartialController', directory))
    })
    mo.it('returns true for an identical type', function () {
      as.ok(ce.isSubtype('ModelicaMode.PartialController', 'ModelicaMode.PartialController', directory))
    })
    mo.it('returns false when a required component is missing', function () {
      as.ok(!ce.isSubtype('ModelicaMode.BadController', 'ModelicaMode.PartialController', directory))
    })
  })

  mo.describe('validateRedeclareConstrainedBy(redeclaredType, instanceName, baseClass, directory)', function () {
    mo.it('passes when the redeclared type is a subtype of the constraining type (G36)', function () {
      const result = ce.validateRedeclareConstrainedBy('ModelicaMode.G36VAVBoxCoolingOnly', instanceName, baseClass, directory)
      as.equal(result.constrainingType, 'ModelicaMode.PartialController')
      as.ok(result.valid, result.message || 'expected G36VAVBoxCoolingOnly to satisfy constrainedby')
    })

    mo.it('passes when the redeclared type is a subtype of the constraining type (OpenLoop)', function () {
      const result = ce.validateRedeclareConstrainedBy('ModelicaMode.OpenLoopVAVBoxCoolingOnly', instanceName, baseClass, directory)
      as.ok(result.valid, result.message || 'expected OpenLoopVAVBoxCoolingOnly to satisfy constrainedby')
    })

    mo.it('fails when the redeclared type is not a subtype of the constraining type (BadController)', function () {
      const result = ce.validateRedeclareConstrainedBy('ModelicaMode.BadController', instanceName, baseClass, directory)
      as.equal(result.constrainingType, 'ModelicaMode.PartialController')
      as.ok(!result.valid, 'expected BadController to fail constrainedby validation')
      as.ok(result.message && result.message.includes('not a subtype'),
        'expected an explanatory failure message')
    })
  })

  mo.describe('validateExtendsRedeclarations(moFile, directory)', function () {
    mo.it('does not throw for a template with a valid redeclared controller', function () {
      const moFile = path.join(templatesDir, 'VAVBoxCoolingOnly.mo')
      as.doesNotThrow(function () { ce.validateExtendsRedeclarations(moFile, directory) })
    })

    mo.it('throws when a template redeclares ctl to a type violating constrainedby (BadController)', function () {
      const moFile = path.join(templatesDir, 'VAVBoxCoolingOnlyInvalid.mo')
      as.throws(
        function () { ce.validateExtendsRedeclarations(moFile, directory) },
        /ModelicaMode\.BadController.*not a subtype.*ModelicaMode\.PartialController/
      )
    })
  })

  mo.describe('getCxfFromModelica(moFile, directory) — export CXF from a template (issue 280)', function () {
    const cxfDir = path.join(process.cwd(), 'cxf', 'test', 'ModelicaMode')

    mo.it('exports CXF for a controller redeclared in an extends clause', function () {
      ce.getCxfFromModelica(path.join(templatesDir, 'VAVBoxCoolingOnly.mo'), directory, true)
      const modelCxf = fs.readFileSync(path.join(cxfDir, 'VAVBoxCoolingOnly.jsonld'), 'utf8')
      const controllerCxf = fs.readFileSync(path.join(cxfDir, 'G36VAVBoxCoolingOnly.jsonld'), 'utf8')
      // The template model contains the control block redeclared as 'ctl',
      // typed by the redeclared controller.
      as.ok(modelCxf.includes('containsBlock'), 'model should contain the control block')
      as.ok(modelCxf.includes('VAVBoxCoolingOnly.ctl'), 'model should reference the ctl instance')
      as.ok(modelCxf.includes('ModelicaMode.G36VAVBoxCoolingOnly'), 'ctl should be typed by the redeclared controller')
      // The control block class CXF exposes its connectors.
      as.ok(controllerCxf.includes('hasInput') && controllerCxf.includes('hasOutput'),
        'control block CXF should expose input and output connectors')
    })

    mo.it('throws when the redeclared controller violates constrainedby', function () {
      as.throws(
        function () { ce.getCxfFromModelica(path.join(templatesDir, 'VAVBoxCoolingOnlyInvalid.mo'), directory, true) },
        /ModelicaMode\.BadController.*not a subtype.*ModelicaMode\.PartialController/
      )
    })
  })

  mo.describe('getCxfGraph() — indexed array instances in connect()', function () {
    function component (typeSpecifier, arraySubscripts = '') {
      return {
        type: 'element',
        type_prefix: '',
        type_specifier: typeSpecifier,
        compositionSpecifier: 'public',
        isVector: arraySubscripts !== '',
        arraySubscripts,
        within: 'FromModelica'
      }
    }

    function connectedTo (graph, id) {
      const node = graph['@graph'].find(entry => decodeURIComponent(entry['@id']) === id)
      const connections = node['S231:isConnectedTo'] || []
      return (Array.isArray(connections) ? connections : [connections]).map(connection => decodeURIComponent(connection['@id']))
    }

    function instanceIds (graph, id) {
      const node = graph['@graph'].find(entry => decodeURIComponent(entry['@id']) === id)
      const instances = node['S231:hasInstance'] || []
      return (Array.isArray(instances) ? instances : [instances]).map(instance => decodeURIComponent(instance['@id']))
    }

    function types (graph, id) {
      const node = graph['@graph'].find(entry => decodeURIComponent(entry['@id']) === id)
      const nodeTypes = node['@type'] || []
      return Array.isArray(nodeTypes) ? nodeTypes : [nodeTypes]
    }

    mo.it('preserves scalar indices and expands a known slice element-wise', function () {
      const instances = {
        IndexedArrayConnections: {
          type: 'long_class_specifier',
          class_prefixes: 'block',
          within: 'FromModelica'
        },
        sources: component('Example.Source', '[2,3]'),
        targets: component('Example.Target', '[2]'),
        receiver: component('Example.Receiver'),
        outputs: component('RealOutput', '[3]'),
        inputs: component('RealInput', '[3]')
      }
      const requiredReferences = {
        connections: {
          'sources[2,3].y': ['targets[2].u'],
          'sources[1,:].y': ['receiver.u'],
          'outputs[2]': ['inputs[1]'],
          'sources[config.index,3].y': ['receiver.u']
        }
      }

      const graph = ce.getCxfGraph(instances, requiredReferences, 'IndexedArrayConnections', false, false)
      const base = 'http://example.org#FromModelica.IndexedArrayConnections.'
      const compactBase = 'ex:FromModelica.IndexedArrayConnections.'

      as.deepEqual(connectedTo(graph, base + 'sources[2,3].y'), [base + 'targets[2].u'])
      as.deepEqual(connectedTo(graph, base + 'outputs[2]'), [base + 'inputs[1]'])
      as.deepEqual(connectedTo(graph, base + 'sources[config.index,3].y'), [compactBase + 'receiver.u'])
      as.ok(instanceIds(graph, compactBase + 'sources').includes(base + 'sources[2,3]'))
      as.ok(instanceIds(graph, base + 'sources[2,3]').includes(base + 'sources[2,3].y'))
      as.deepEqual(types(graph, base + 'outputs[2]'), ['S231:RealOutput'])
      as.deepEqual(types(graph, base + 'inputs[1]'), ['S231:RealInput'])
      for (let i = 1; i <= 3; i++) {
        as.deepEqual(connectedTo(graph, base + `sources[1,${i}].y`), [base + `receiver.u[${i}]`])
      }
    })

    mo.it('rejects ranges until range expansion is implemented', function () {
      const instances = {
        IndexedArrayConnections: {
          type: 'long_class_specifier',
          class_prefixes: 'block',
          within: 'FromModelica'
        },
        sources: component('Example.Source', '[2,3]'),
        receiver: component('Example.Receiver')
      }

      as.throws(
        () => ce.getCxfGraph(instances, { connections: { 'sources[1:2,3].y': ['receiver.u'] } }, 'IndexedArrayConnections', false, false),
        /Cannot expand array range/
      )
    })
  })

  mo.describe('String parameter values (S231:value is Modelica expression text)', function () {
    const moFile = path.join(__dirname, 'FromModelica', 'StringParameters.mo')
    const cxfFile = path.join(process.cwd(), 'cxf', 'test', 'FromModelica', 'StringParameters.jsonld')
    let graph

    function nodeById (id) {
      const node = graph.find(n => n['@id'] === id)
      as.ok(node !== undefined, `node ${id} missing from the CXF graph`)
      return node
    }

    mo.before(function () {
      // CXF is written in 'cdl' mode only (the default), as the FromModelica
      // regression in test_parser.js runs it.
      pa.getJsons([moFile], 'cxf', 'current', true, false, false, 'cdl')
      graph = JSON.parse(fs.readFileSync(cxfFile, 'utf8'))['@graph']
    })

    mo.it('keeps the quotes of a string literal', function () {
      as.strictEqual(nodeById('ex:FromModelica.StringParameters.quantityUnit')['S231:value'], '"W"')
      as.strictEqual(nodeById('ex:FromModelica.StringParameters.compoundUnit')['S231:value'], '"kg/s"')
    })

    mo.it('writes a parameter reference as the bare identifier', function () {
      as.strictEqual(nodeById('ex:FromModelica.StringParameters.unitAlias')['S231:value'], 'quantityUnit')
    })

    mo.it('does not turn the text "true" into a Boolean', function () {
      as.strictEqual(nodeById('ex:FromModelica.StringParameters.notABoolean')['S231:value'], '"true"')
      as.strictEqual(nodeById('ex:FromModelica.StringParameters.isBoolean')['S231:value'], true)
    })

    mo.it('emits a unit for a literal and no unit for a parameter reference', function () {
      const uLit = nodeById('ex:FromModelica.StringParameters.uLit')
      as.deepStrictEqual(uLit['qudt:hasUnit'], { '@id': 'unit:W' })
      const uRef = nodeById('ex:FromModelica.StringParameters.uRef')
      as.strictEqual(uRef['qudt:hasUnit'], undefined)
    })
  })

  mo.describe('for-loop connect equations', function () {
    const errorsDir = path.join(__dirname, 'ForLoopErrors')
    const moFile = path.join(__dirname, 'FromModelica', 'ForLoopConnections.mo')
    const cxfFile = path.join(process.cwd(), 'cxf', 'test', 'FromModelica', 'ForLoopConnections.jsonld')
    let graph

    /** Every (from, to) pair the graph connects, as `@id` strings. */
    function edges () {
      const out = []
      graph.forEach(node => {
        const to = node['S231:isConnectedTo']
        if (to === undefined) return
        const targets = Array.isArray(to) ? to : [to]
        targets.forEach(t => out.push([node['@id'], t['@id']]))
      })
      return out
    }

    mo.before(function () {
      // CXF is written in 'cdl' mode only (the default).
      pa.getJsons([moFile], 'cxf', 'current', true, false, false, 'cdl')
      graph = JSON.parse(fs.readFileSync(cxfFile, 'utf8'))['@graph']
      // getCxfFromModelica reads the objects JSON a 'modelica'-mode pass
      // writes (no CXF is produced in that mode, so nothing throws here).
      const errorFiles = ['Broadcast', 'OffsetRange', 'DerivedIndex', 'NestedLoop', 'PartialRange', 'MixedBody']
        .map(name => path.join(errorsDir, name + '.mo'))
      pa.getJsons(errorFiles, 'cxf', 'current', true, false, false, 'modelica')
    })

    mo.it('maps a full-cover loop to one wholesale connection per connect', function () {
      const p = 'ex:FromModelica.ForLoopConnections.'
      const expected = [
        [p + 'u', p + 'gai.u'],
        [p + 'gai.y', p + 'abs1.u'],
        [p + 'abs1.y', p + 'y'],
        [p + 'abs1.y', p + 'mulSum.u'],
        [p + 'con.y', p + 'abs2.u'],
        [p + 'mulSum.y', p + 'ySum']
      ]
      const actual = edges().map(e => e.join(' -> ')).sort()
      as.deepStrictEqual(actual, expected.map(e => e.join(' -> ')).sort())
    })

    mo.it('writes no per-element nodes for loop-connected elements', function () {
      as.ok(graph.every(node => !node['@id'].includes('%5B')), 'found an element node')
    })

    /** Build the CXF graph of one ForLoopErrors block from the objects JSON
     *  the before hook wrote — the same path `getJsons` takes for a CDL
     *  block (getCxfFromModelica is the template-model entry and does
     *  nothing for a block without a control instance). */
    function cxfGraphOf (name) {
      const objectsFile = path.join(process.cwd(), 'objects', 'test', 'ForLoopErrors', name + '.json')
      const objects = JSON.parse(fs.readFileSync(objectsFile, 'utf8'))
      return ce.getCxfGraph(objects.instances, objects.requiredReferences, name, false, false, directory)
    }

    mo.it('maps the connects of a loop whose body also has a non-connect equation', function () {
      as.doesNotThrow(function () { cxfGraphOf('MixedBody') })
    })

    const refused = [
      ['Broadcast', /does not use the loop index/],
      ['OffsetRange', /lower bound is not 1/],
      ['DerivedIndex', /uses a derived index/],
      ['NestedLoop', /nested/],
      ['PartialRange', /does not cover/]
    ]
    refused.forEach(([name, reason]) => {
      mo.it(`refuses ${name}.mo with a reason`, function () {
        as.throws(
          function () { cxfGraphOf(name) },
          new RegExp('cannot express for-loop connect.*' + reason.source)
        )
      })
    })
  })

  mo.describe('pass-through equations (y = u)', function () {
    const moFile = path.join(__dirname, 'FromModelica', 'PassthroughEquation.mo')
    const cxfFile = path.join(process.cwd(), 'cxf', 'test', 'FromModelica', 'PassthroughEquation.jsonld')
    const objFile = path.join(process.cwd(), 'objects', 'test', 'FromModelica', 'PassthroughEquation.json')
    let graph

    mo.before(function () {
      // CXF is written in 'cdl' mode only (the default).
      pa.getJsons([moFile], 'cxf', 'current', true, false, false, 'cdl')
      graph = JSON.parse(fs.readFileSync(cxfFile, 'utf8'))['@graph']
    })

    mo.it('connects the input to the output it is assigned to', function () {
      const u = graph.find(n => n['@id'] === 'ex:FromModelica.PassthroughEquation.u')
      const to = u['S231:isConnectedTo']
      const targets = (Array.isArray(to) ? to : [to]).map(t => t['@id']).sort()
      as.deepStrictEqual(targets, ['ex:FromModelica.PassthroughEquation.abs1.u', 'ex:FromModelica.PassthroughEquation.yInAct'])
    })

    mo.it('records the pass-through in the objects JSON and nothing else', function () {
      const objects = JSON.parse(fs.readFileSync(objFile, 'utf8'))
      as.deepStrictEqual(objects.requiredReferences.passthroughEquations, [{ from: 'u', to: 'yInAct' }])
    })
  })
})

mo.describe('getDataTypeNode: MSL Real-derived type aliases', function () {
  // `Modelica.Units.SI` (and its predecessors) contain exclusively
  // Real-derived quantity types — `type Time = Real(final quantity="Time",
  // final unit="s")` and friends. A parameter declared with one, e.g.
  // Buildings.Controls.SetPoints.OccupancySchedule's
  // `parameter Modelica.Units.SI.Time period`, previously yielded no
  // S231:isOfDataType triple at all, so strict CXF consumers rejected the
  // block (CXF_MISSING_REQUIRED).
  const s231Ns = name => ({ s231: name })
  const cxfPrefix = name => ({ ex: name })

  mo.it('maps Modelica.Units.SI.Time to S231:Real', function () {
    const node = ce.getDataTypeNode('Modelica.Units.SI.Time', { within: 'X', fullMoFilePath: '/x.mo' }, s231Ns, cxfPrefix)
    as.deepEqual(node, { s231: 'Real' })
  })

  mo.it('maps the legacy Modelica.SIunits spelling', function () {
    const node = ce.getDataTypeNode('Modelica.SIunits.Temperature', { within: 'X', fullMoFilePath: '/x.mo' }, s231Ns, cxfPrefix)
    as.deepEqual(node, { s231: 'Real' })
  })

  mo.it('maps Modelica.Units.NonSI aliases', function () {
    const node = ce.getDataTypeNode('Modelica.Units.NonSI.Temperature_degC', { within: 'X', fullMoFilePath: '/x.mo' }, s231Ns, cxfPrefix)
    as.deepEqual(node, { s231: 'Real' })
  })

  mo.it('still yields null for an unknown non-MSL alias', function () {
    const node = ce.getDataTypeNode('Some.Custom.Alias', { within: 'X', fullMoFilePath: '/x.mo' }, s231Ns, cxfPrefix)
    as.equal(node, null)
  })
})
