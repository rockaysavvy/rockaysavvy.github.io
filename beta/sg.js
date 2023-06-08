const SVG_NS = 'http://www.w3.org/2000/svg'
const DATA = JSON.parse(document.getElementById('sg-data').textContent)
const main = document.getElementById('sg-main')

function svge(name, ...xs) {
  const el = document.createElementNS(SVG_NS, name)
  for (const x of xs) {
    if (x.constructor === Object) {
      for (const k of Object.keys(x)) {
        el.setAttribute(k, x[k])
      }
    } else if (x instanceof Node) {
      el.append(x)
    } else {
      el.textContent = String(x)
    }
  }
  return el
}
const DEFAULT_CONDITION_OPERATOR = 'EMETA_ConditionOperator::Equal'
const DEFAULT_CONDITION_EXPR_OPERATOR = 'EMETA_ConditionExprOperator::And'
const DEFAULT_CHARACTER_MOOD = 'undefined' // TODO
const DEFAULT_UNARY_OPERATION = 'EMETA_UnaryOperation::Increment'
const DEFAULT_ACTION_EXPRESSION_TYPE = 'EMETA_ActionExpressionType::NewEnumerator0'
function pretty(s) {
  if (s === 'EMETA_ActionExpressionType::NewEnumerator0') return 'Add' //'Addition'
  if (s === 'EMETA_ActionExpressionType::NewEnumerator1') return 'Subtract' //'Subtraction'
  if (s === 'EMETA_ConditionOperator::Greater') return '>'
  if (s === 'EMETA_ConditionOperator::GreaterOrEqual') return '≥'
  if (s === 'EMETA_ConditionOperator::Less') return '<'
  if (s === 'EMETA_ConditionOperator::LessOrEqual') return '≤'
  if (s === 'EMETA_ConditionOperator::NotEqual') return '≠'
  if (s === 'EMETA_ConditionOperator::Equal') return '='
  s = String(s)
  if (s.endsWith("'")) {
    s = s.slice(0, -1).split("'").pop()
  }
  return s
    // .replace(/^(?:BlueprintGeneratedClass|BinkMediaPlayer) /g, '')
    .replace(/^.+::/g, '')
    .replace(/^(?:META|BP|BMP|SG|DA|DT)_|(_(?:SG|C|MissionID))+$/g, '')
    // .replace(/^(?:META|BP|BMP|SG|DA|DT|meta|Char)_|^Meta(?:Data)?\.|_(?:SG|C)$/g, '')
    // .replace(/Node$|_(?:MissionID|WeaponDefinitionObject)$/g, '')
    // .replace(/([a-z])([A-Z])/g, '$1 $2')
    // .replace(/_/g, ' ')
}
function prettyTag(t) {
  return pretty(t ? t.TagName : 'None')
}
function prettyRef(s) {
  return s && pretty(s.ObjectName)
}
function prettyAsset(s) {
  return s && pretty(s.AssetPathName.split('.').pop())
}
function percent(f) {
  return Math.round(f * 1000)/10 + '%'
}

let types
const refs = {}
function deref(ref) {
  if (typeof ref === 'object') {
    const i = +ref.ObjectPath.split('.').pop()
    if (!DATA[i] || !ref.ObjectName.includes(DATA[i].Name)) {
      console.error('external reference', ref, i, DATA[i])
    }
    ref = i
  }
  if (!refs[ref]) {
    if (!types[DATA[ref].Type]) {
      console.error('unknown type', DATA[ref].Type)
    }
    refs[ref] = new types[DATA[ref].Type]()
    refs[ref].init(DATA[ref])
  }
  return refs[ref]
}
function fixMap(arr) {
  return Array.isArray(arr) ? Object.fromEntries(arr.map(n => Object.entries(n)[0])) : arr
}

class META_StoryGraph {
  init(o) {
    this.nodes = Object.fromEntries(Object.entries(fixMap(o.Properties.AllNodes ?? [])).map(([k, ref]) => [k, deref(ref)]))
    this.root = deref(o.Properties.RootNode)
    this.syntheticRoot = new SyntheticRoot(this.orphans())
    this.panX = 0
    this.panY = 0
    this.zoom = 1
  }
  orphans() {
    return Object.values(this.nodes).filter(n => !n.parents.length)
  }

  populate() {
    if (this.populated) return
    this.populated = true

    this.g = svge('g')
    main.append(this.g)
    this.syntheticRoot.populateRecursive(this.g, 10, 10)
    this.syntheticRoot.drawEdgesRecursive(this.g)

    const i = +location.hash.slice(1)
    this.highlightNode(i && this.nodes[i] || this.root, true)

    main.addEventListener('mousedown', e => {
      const g = e.target.closest('g')
      if (g && g.node) this.highlightNode(g.node)
      if (e.button === 0) {
        this.basisX = this.panX - e.clientX
        this.basisY = this.panY - e.clientY
        main.style.cursor = 'grabbing'
      }
    })
    main.addEventListener('mousemove', e => {
      if (this.basisX == null) return
      this.panX = this.basisX + e.clientX
      this.panY = this.basisY + e.clientY
      this.updateTransform()
      e.preventDefault()
    })
    main.addEventListener('mouseup', e => {
      if (e.button === 0) {
        this.basisX = null
        this.basisY = null
        main.style.cursor = ''
      }
    })
    main.addEventListener('click', e => {
      const g = e.target.closest('g')
      if (g && g.node && e.button === 0 && e.detail === 2) {
        const assets = g.node.linkedAssets()
        const asset = assets[0]
        if (asset) {
          const file = asset.AssetPathName.split('.')[0].split('/').pop()
          if (file.startsWith('SG_') || file.startsWith('SGS_')) {
            location.href = '/sgs/' + file
          } else {
            console.error('unhandled asset', asset)
          }
        }
      }
    })
    main.addEventListener('wheel', e => {
      e.preventDefault()
      const d = 16 ** e.deltaMode
      if (e.ctrlKey) {
        // a = m/z - p
        // a*z + p + m = a*z' + p' + m
        // p' = p + a*(z - z')
        const z = this.zoom
        const ax = (e.clientX - this.panX)/z
        const ay = (e.clientY - this.panY)/z
        this.zoom = Math.max(0.1, this.zoom * 2**(-e.deltaY * d * .005))
        this.panX = this.panX + ax * (z - this.zoom)
        this.panY = this.panY + ay * (z - this.zoom)
      } else {
        this.panX = this.panX - e.deltaX * d
        this.panY = this.panY - e.deltaY * d
      }
      this.updateTransform()
    })
  }
  get rootId() {
    const x = Object.entries(this.nodes).find(n => n[1] === this.root)
    return x && x[0]
  }
  highlightNode(node, scroll) {
    if (this.highlighted) {
      this.highlighted.unlight()
    }
    ;(this.highlighted = node).light()
    if (scroll) {
      this.panX = Math.min(0, -node.nodeX + (innerWidth - node.nodeWidth)/2)
      this.panY = Math.min(0, -node.nodeY + (innerHeight - node.nodeHeight)/2)
      this.updateTransform()
    }
    location.replace('#' + (node.id || this.rootId))
  }
  updateTransform() {
    const tx = main.createSVGTransform()
    tx.setTranslate(this.panX, this.panY)
    const tx2 = main.createSVGTransform()
    tx2.setScale(this.zoom, this.zoom)
    this.g.transform.baseVal.initialize(tx)
    this.g.transform.baseVal.appendItem(tx2)
  }
}
class Base {
  init(o) {
    this._props = o.Properties
  }
  get prettyName() {
    return pretty(this.constructor.name)
  }
  head() {
    return this.prettyName
  }
  info() {
    return ''
  }
  populate(g) {
    let y = 5
    let w = 200
    y += 10
    const head = svge('text', {
      fill: '#fff',
      x: 5,
      y,
    }, this.head())
    head.style.font = 'bold 10px sans-serif'
    if (this.linkedAssets().length) {
      head.style.textDecoration = 'underline'
    }
    g.append(head)
    w = Math.max(w, head.getComputedTextLength() + 40)
    const info = this.info()
    let bad = false
    if (info) {
      for (let line of info.split('\n')) {
        const debug = /^\s*&/.test(line)
        if (debug) line = line.replace(/^(\s*)&/, '$1')
        const error = /\bundefined\b/.test(line)
        if (error) bad = true
        y += 12
        const text = svge('text', {
          fill: debug ? '#888' : '#ccc',
          x: 5,
          y,
        }, line)
        text.style.font = (debug ? 'italic ' : '') + '12px sans-serif'
        g.append(text)
        w = Math.max(w, text.getComputedTextLength())
      }
    }

    if (this.id != null) {
      const id = svge('text', {
        fill: '#888',
        x: 5 + w,
        y: 5 + 9,
      }, `#${this.id}`)
      id.style.font = '9px sans-serif'
      id.setAttribute('text-anchor', 'end')
      g.append(id)
    }

    y += 5
    const width = 5 + w + 5
    g.prepend(this.box = svge('rect', {
      width,
      height: y,
      rx: 3,
      fill: bad ? '#411' : '#222',
      stroke: bad ? '#822' : '#666',
    }))

    g.node = this
    return {width, height: y}
  }
  light() {
    this.box.style.stroke = '#8ff'
    for (const e of this.edgeLines) {
      e.style.stroke = '#8ff'
    }
    for (const p of this.parents) {
      for (let i = 0; i < p.children.length; ++i) {
        if (p.children[i] === this) {
          p.edgeLines[i].style.stroke = '#f8f'
        }
      }
    }
  }
  unlight() {
    this.box.style.stroke = ''
    for (const e of this.edgeLines) {
      e.style.stroke = ''
    }
    for (const p of this.parents) {
      for (let i = 0; i < p.children.length; ++i) {
        if (p.children[i] === this) {
          p.edgeLines[i].style.stroke = ''
        }
      }
    }
  }
  populateRecursive(canvas, bx, by) {
    if (this.populated) {
      const {x, y, width, height} = this.populated
      return {x, y, width, height, below: 0}
    }
    const g = svge('g')
    canvas.append(g)
    const {width, height} = this.populate(g)

    const o = {
      x: bx,
      y: by,
      width,
      height,
      below: width,
    }
    this.populated = o
    this.labels = this.children.map(c => this.edgeLabel(c))
    const y = by + height + (this.synthetic ? 0 : this.labels.some(l => l) ? 30 : 10)
    let below = 0
    const outs = []
    for (const child of this.children) {
      if (below) below += 20
      const out = child.populateRecursive(canvas, bx + below, y)
      below += out.below
    }
    below = Math.max(width, below)
    const bnx = bx + (below - width) / 2

    const tx = main.createSVGTransform()
    tx.setTranslate(bnx, by)
    g.transform.baseVal.initialize(tx)

    this.nodeX = bnx
    this.nodeY = by
    this.nodeWidth = width
    this.nodeHeight = height
    o.x = bnx
    o.y = by
    o.width = width
    o.height = height
    o.below = below
    return o
  }
  drawEdgesRecursive(canvas) {
    if (this.hasEdges) return
    this.drawEdges(canvas)
    for (const child of this.children) {
      child.drawEdgesRecursive(canvas)
    }
  }
  drawEdges(canvas) {
    this.hasEdges = true
    this.edgeLines = []
    if (!this.synthetic) {
      // const sxi = width/(outs.length + 1)
      // let sx = bnx + sxi
      const sx = this.nodeX + this.nodeWidth/2
      for (let i = 0; i < this.children.length; ++i) {
        const child = this.children[i]
        const label = this.labels[i]
        // const sy = child.nodeY < by ? by : by + height
        // const ey = child.nodeY < by ? child.nodeY + child.nodeHeight : child.nodeY
        const sy = this.nodeY + this.nodeHeight
        const ey = child.nodeY
        const ex = child.nodeX + child.nodeWidth/2
        const line = svge('path', {
          d: `M${sx} ${sy} L${ex} ${ey}`,
          stroke: '#aa6',
        })
        this.edgeLines.push(line)
        canvas.append(line)
        if (label) {
          const lx = (sx + ex)/2
          const ly = (sy + ey)/2 + 6
          const text = svge('text', {
            fill: '#fff',
            x: lx,
            y: ly,
          }, String(label))
          text.setAttribute('text-anchor', 'middle')
          text.style.font = '12px sans-serif'
          canvas.append(text)
          const LPX = 8, LPY = 3
          const lw = text.getComputedTextLength()
          text.before(svge('rect', {
            x: lx - lw/2 - LPX,
            y: ly - 12 - LPY,
            width: LPX + lw + LPX,
            height: LPY + 12 + LPY,
            fill: '#666',
            rx: 6,
          }))
        }
        // sx += sxi
      }
    }
  }
  edgeLabel() {}
  linkedAssets() {
    return []
  }
}
class META_Node_SG extends Base {
  init(o) {
    super.init(o)
    this.id = o.Properties.Id
    this.parents = (o.Properties.ParentNodes ?? []).map(deref)
    this.children = (o.Properties.ChildrenNodes ?? []).map(deref)
    // this.edges = TODO
  }
}
class SyntheticRoot extends Base {
  constructor(children) {
    super()
    this.children = children
    this.init({})
  }
  get synthetic() {
    return true
  }
  populate(g) {
    return {width: 0, height: 0}
  }
}
class META_UnaryOperationNode_SG extends META_Node_SG {
  init(o) {
    super.init(o)
    this.var = o.Properties.GraphVariable
    this.operation = o.Properties.UnaryOperation ?? DEFAULT_UNARY_OPERATION
  }
  info() {
    return pretty(this.operation) + ' ' + prettyTag(this.var)
  }
}
class META_RootNode_SG extends META_Node_SG {}
class META_ActionsNode_SG extends META_Node_SG {
  init(o) {
    super.init(o)
    this.actions = (o.Properties?.Actions ?? []).map(deref)
  }
  info() {
    return this.actions.map(a => a.info()).join('\n')
  }
  linkedAssets() {
    return this.actions.flatMap(a => a.linkedAssets())
  }
}
class META_TaskNode_SG extends META_Node_SG {
  init(o) {
    super.init(o)
    this.task = deref(o.Properties.Task)
  }
  info() {
    return this.task.info()
  }
}
class META_CallbackNode_SG extends META_Node_SG {
  init(o) {
    super.init(o)
    this.callback = deref(o.Properties.CallbackObject)
    this.nextNodes = fixMap(o.Properties.NextNodesMap ?? [])
  }
  info() {
    return this.callback.info()
  }
  edgeLabel(out) {
    return this.callback.edgeLabel(out)
  }
}
class META_RandomBranchNode_SG extends META_Node_SG {
  init(o) {
    super.init(o)
    this.waysChances = o.Properties.WaysChances
    this.total = this.waysChances.reduce((a, w) => a + w.Chance, 0)
  }
  info() {
    return ''
  }
  edgeLabel(out) {
    const n = this.waysChances.find(w => w.NodeId === out.id)
    // return n && n.Chance + '/' + this.total
    return n && percent(n.Chance / this.total)
  }
}
class META_SwitchNode_SG extends META_Node_SG {
  init(o) {
    super.init(o)
    this.cases = fixMap(o.Properties?.Cases ?? [])
    this.condition = o.Properties?.ConditionGraphTag
  }
  info() {
    return prettyTag(this.condition)
  }
  edgeLabel(out) {
    const entry = Object.entries(this.cases).find(([_, id]) => id === out.id)
    return (entry ? entry[0] : '') + (this.defaultId === out.id ? '+default' : '')
  }
}
class META_BranchNode_SG extends META_Node_SG {
  init(o) {
    super.init(o)
    // SG_THV_TwoBanks_Goal has Conditions: [null] somewhere in it
    this.conditions = (o.Properties?.Conditions ?? []).filter(x => x).map(deref)
    this.operator = o.Properties?.ConditionOperator ?? DEFAULT_CONDITION_EXPR_OPERATOR
    this.true = o.Properties?.TrueNodeId
    this.false = o.Properties?.FalseNodeId
  }
  head() {
    return this.prettyName + ': ' + pretty(this.operator)
  }
  info() {
    return this.conditions.map(c => c.info()).join('\n')
  }
  linkedAssets() {
    return this.conditions.flatMap(c => c.linkedAssets())
  }
  edgeLabel(out) {
    if (out.id == this.true) return 'Y'
    if (out.id == this.false) return 'N'
  }
}
class META_SubGraphNode_SG extends META_Node_SG {
  init(o) {
    super.init(o)
    this.subgraph = o.Properties?.SubGraph
    this.oldConnections = o.Properties?.OldConnectionsCount
    this.true = o.Properties?.TrueNodeId
    this.false = o.Properties?.FalseNodeId
  }
  info() {
    return prettyAsset(this.subgraph)
  }
  linkedAssets() {
    return [this.subgraph]
  }
  edgeLabel(out) {
    if (out.id == this.true) return 'Y'
    if (out.id == this.false) return 'N'
  }
}
class META_ConditionsNode_SG extends META_Node_SG {
  init(o) {
    super.init(o)
    this.operator = o.Properties?.ConditionOperator ?? DEFAULT_CONDITION_EXPR_OPERATOR
    this.conditions = (o.Properties?.Conditions ?? []).filter(x => x).map(deref)
  }
  linkedAssets() {
    return this.conditions.flatMap(c => c.linkedAssets())
  }
  head() {
    return this.prettyName + ': ' + pretty(this.operator)
  }
  info() {
    return this.conditions.map(c => c.info()).join('\n')
  }
}
class META_ParallelizationNode_SG extends META_Node_SG {
  info() {
    return ''
  }
}
class META_EndNode_SG extends META_Node_SG {
  info() {
    return ''
  }
}
class META_LoopBranchNode extends META_Node_SG {
  init(o) {
    super.init(o)
    this.activations = o.Properties.AmountOfActivations
    this.continue = o.Properties.ContinueNodeId
    this.exit = o.Properties.LimitExceededNodeId
  }
  info() {
    return `activations: ${this.activations}`
  }
  edgeLabel(out) {
    if (out.id === this.continue) return 'continue'
    if (out.id === this.exit) return 'exit'
  }
}
class META_TimerNode_SG extends META_Node_SG {
  init(o) {
    super.init(o)
    // TODO: double check these defaults
    this.minDays = o.Properties.MinDaysValue ?? 1
    this.maxDays = o.Properties.MaxDaysValue ?? 1
    this.continueAfter = o.Properties.ContinueAfter
    this.shouldBeReset = o.Properties.bShouldBeResetted
  }
  info() {
    return `min days: ${this.minDays}\nmax days: ${this.maxDays}\ncontinue after: ${pretty(this.continueAfter)}`
  }
}
class META_MediaNode_SG extends META_Node_SG {
  init(o) {
    super.init(o)
    this.type = o.Properties.MediaNodeType
    this.execution = deref(o.Properties.ExecutionBlueprint)
    this.results = fixMap(o.Properties.ResultNodesMap ?? [])
  }
  edgeLabel(out) {
    const x = Object.entries(this.results).find(([_, id]) => out.id === id)
    return x && x[0]
  }
  info() {
    return `${this.execution.info()}\ntype: ${pretty(this.type)}`
  }
}
// TODO: remove this
class BP_Base_C extends Base {
  init(o) {
    this._props = o.Properties ?? {}
    this.owner = o.Properties?.OwnerNode && deref(o.Properties.OwnerNode)
    this.event = o.Properties?.EventTag?.TagName ?? o.Properties?.EventID?.TagName
    this.chance = o.Properties?.Chance ?? 1
    this.debug = o.Properties?.DebugText?.LocalizedString
    this.invert = o.Properties?.InvertResult
  }
  info() {
    const details = String(this.details()) + (this.debug ? '\n&' + this.debug : '')
    return (this.invert ? 'not ' : '') + (this.chance === 1 ? '' : percent(this.chance) + ' ') + this.prettyName + (details ? ': ' + details.replace(/\n/g, '\n  ') : '')
  }
  details() {
    return 'undefined'
  }
  linkedAssets() {return []}
}
class META_BaseAction extends BP_Base_C {}
class META_BaseCondition extends BP_Base_C {}
class META_BaseHeisterCondition extends BP_Base_C {
  // TODO
}
class META_HeisterAction extends BP_Base_C {
  init(o) {
    super.init(o)
    // TODO: correct defaults
    this.source = o.Properties?.HeistersSource // EMETA_HeistersSourceEvent::FromCrewOrByID
    this.scope = o.Properties?.ActionScope // EMETA_HeisterActionScope::SortedHeistersByConditions | EMETA_HeisterActionScope::ByCharacterID
    this.character = o.Properties?.CharacterID
    this.index = o.Properties?.Index
    this.amount = o.Properties?.AmountOfHeisters
    this.maxAmount = o.Properties?.MaxAmountOfSortedHeisters
    this.conditions = (o.Properties?.SortingConditions ?? []).map(deref)
    this.event = o.Properties?.EventTag
  }
  details() {
    // TODO: index, character ID
    return '\n' + (this.maxAmount === -1 ? 'all ' : '') +
      (this.amount ? this.amount + ' ' : '') +
      (this.scope === 'EMETA_HeisterActionScope::ByCharacterID' ? pretty(this.character) : this.scope ? pretty(this.scope) : '') +
      (this.event ? ' in event ' + prettyTag(this.event) : '') +
      (this.maxAmount > 0 ? ' ≤ ' + this.maxAmount : '') +
      (this.conditions.length ? '\n– ' + this.conditions.map(c => c.info()).join('\n– ') : '') +
      '\n' + this.specificDetails()
  }
}
class BP_BaseHeisterAction_C extends META_HeisterAction {}
class BP_PromoteHeister_C extends BP_BaseHeisterAction_C {
  init(o) {
    super.init(o)
    this.free = o.Properties?.FreePromotion ?? false
  }
  specificDetails() {
    return this.free ? 'free' : '' // TODO
  }
}
class BP_AddWeaponsToSpecificCharacterInCrew_C extends BP_BaseHeisterAction_C {
  init(o) {
    super.init(o)
    this.primary = o.Properties?.LoadoutOverride?.PrimaryWeapon
    this.secondary = o.Properties?.LoadoutOverride?.SecondaryWeapon
    this.equipment = o.Properties?.LoadoutOverride?.Equipment ?? []
    this.saveEquipments = o.Properties?.['Save Previous Equipments'] ?? false
    this.saveWeapons = o.Properties?.['Save Previous Weapons'] ?? false
  }
  specificDetails() {
    // TODO: equipment
    return 'saving ' + [this.saveEquipments && 'equipments', this.saveWeapons && 'weapons'].filter(x => x).join(', ') + (this.primary ? '\nprimary: ' + prettyRef(this.primary) : '') + (this.secondary ? '\nsecondary: ' + prettyRef(this.secondary) : '')
  }
}
class BP_ChangeHeisterMood_C extends BP_BaseHeisterAction_C {
  init(o) {
    super.init(o)
    this.operation = o.Properties.ChangeOperation ?? DEFAULT_UNARY_OPERATION
  }
  specificDetails() {
    return pretty(this.operation)
  }
}
class BP_KillHeister_C extends BP_BaseHeisterAction_C {
  init(o) {
    super.init(o)
  }
  specificDetails() {
    return this.index
  }
}
class BP_AddTraitToHeister_C extends BP_BaseHeisterAction_C {
  init(o) {
    super.init(o)
    this.traitPool = o.Properties.PoolOfTraits
  }
  specificDetails() {
    return this.traitPool.length === 1 ? pretty(this.traitPool[0]) : 'one of:\n– ' + this.traitPool.map(pretty).join('\n– ')
  }
}
class BP_AddHeisterToEvent_C extends BP_BaseHeisterAction_C {
  init(o) {
    super.init(o)
    this.event = o.Properties?.EventID ?? {TagName: 'None'}
    this.useInternalCheckForState = o.Properties?.UseInternalCheckForState ?? true
  }
  specificDetails() {
    // TODO: UseInternalCheckForState
    return prettyTag(this.event)
  }
}
class BP_ChangeHeisterAttributeByDuration_C extends BP_BaseHeisterAction_C {
  init(o) {
    super.init(o)
    this.multiplier = o.Properties?.ChangeMultiplier ?? 1
    this.days = o.Properties?.DurationDays ?? 0
    this.attribute = o.Properties?.Attribute
    this.useInternalCheckForState = o.Properties?.UseInternalCheckForState ?? true
  }
  specificDetails() {
    // TODO: UseInternalCheckForState
    return pretty(this.attribute) + ' by ' + percent(this.multiplier - 1) + ' for ' + this.days + ' day(s)'
  }
}
class BP_RemoveHeistersFromEvent_C extends BP_BaseHeisterAction_C {
  init(o) {
    super.init(o)
    this.event = o.Properties?.EventTag ?? {TagName: 'None'}
    // TODO StateAfterEvent
  }
  specificDetails() {
    return prettyTag(this.event)
  }
}
class BP_RemoveTraitFromHeister_C extends BP_BaseHeisterAction_C {
  init(o) {
    super.init(o)
    this.traitPool = o.Properties.PoolOfTraits
  }
  specificDetails() {
    return this.traitPool.length === 1 ? pretty(this.traitPool[0]) : 'one of:\n– ' + this.traitPool.map(pretty).join('\n– ')
  }
}
class BP_SetHeisterState_C extends BP_BaseHeisterAction_C {
  init(o) {
    super.init(o)
    this.state = o.Properties.State
  }
  specificDetails() {
    return pretty(this.state)
  }
}
class BP_HeisterLeavesCrew_C extends BP_BaseHeisterAction_C {
  init(o) {
    super.init(o)
    this.transferLoadout = o.Properties?.['Transfer Loadout to Stash'] ?? false
    this.unpaid = o.Properties?.LeavesBecauseWasUnpaid ?? false
  }
  specificDetails() {
    return (this.transferLoadout ? '' : 'don\'t ') + 'transfer loadout' + (this.unpaid ? '\nbecause unpaid' : '')
  }
}
class BP_ChangeHeisterLevel_C extends BP_BaseHeisterAction_C {
  init(o) {
    super.init(o)
    this.maxLeveled = o.Properties?.MaxLeveled ?? false
  }
  specificDetails() {
    return this.maxLeveled ? 'max leveled' : ''
  }
}
class BP_FireHeister_C extends BP_BaseHeisterAction_C {
  specificDetails() {
    return ''
  }
}
class BP_ChangeHeatState_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.operation = o.Properties?.Operation ?? DEFAULT_UNARY_OPERATION
  }
  details() {
    return pretty(this.operation)
  }
}
class BP_RefreshCityMap_C extends META_BaseAction {
  details() {
    return ''
  }
}
class BP_RemoveRandomAsset_C extends META_BaseAction {
  details() {
    return ''
  }
}
class BP_ForceRandomEvent_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.event = o.Properties?.['Event ID'] ?? {TagName: 'None'}
    this.partner = o.Properties?.Partner
    this.gang = o.Properties?.Gang
  }
  details() {
    return prettyTag(this.event) + `\npartner: ${pretty(this.partner)}` + `\ngang: ${pretty(this.gang)}`
  }
}
class BP_PlayMetaDialogue_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.id = o.Properties?.ID ?? {
      TableId: "/Game/00_Main/Core/Tables/Cutscenes/Meta/ST_MetaCutscenes.ST_MetaCutscenes",
      Key: "ID_None",
    }
  }
  details() {
    // TODO
    return pretty(this.id.Key)
  }
}
class BP_EndCampaign_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.reason = o.Properties?.CompletionReason ?? 'EMETA_CareerCompletionReason::HQStorm'
    this.gang = o.Properties?.OptionalGang
  }
  details() {
    return pretty(this.reason) + (this.gang ? `\ngang: ${pretty(this.gang)}` : '')
  }
}
class BP_ForceJobBaseAction_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.job = o.Properties?.JobID
    this.goal = o.Properties?.GoalID
    this.usingCrew = o.Properties?.IsTemporaryCrew // EMETA_UsingCrewInGraph
  }
  details() {
    return (this.job ? `\njob: ${prettyRef(this.job)}` : '') + (this.goal ? `\ngoal: ${prettyRef(this.goal)}` : '') + `\ncrew: ${pretty(this.usingCrew)}` + this.specificDetails()
  }
}
class BP_ForceJobWithOwnedCrew_C extends BP_ForceJobBaseAction_C {
  init(o) {
    super.init(o)
    this.fixed = o.Properties?.FixedCharacters ?? []
    this.preferUnique = o.Properties?.PreferUnique ?? false
    this.prioritizeMostUsed = o.Properties?.PrioriziteMostUsed ?? false
  }
  specificDetails() {
    return (this.fixed.length ? `\n${this.fixed.map(pretty).join(', ')}` : '') + (this.preferUnique ? '\nprefer unique' : '') + (this.prioritizeMostUsed ? '\nprioritize most used' : '')
  }
}
class BP_ForceJobWithUnique_C extends BP_ForceJobBaseAction_C {
  init(o) {
    super.init(o)
    this.fixed = o.Properties?.FixedCharacters ?? []
    this.random = o.Properties?.RandomizedCharacters ?? []
  }
  specificDetails() {
    return (this.fixed.length ? `\nfixed: ${this.fixed.map(pretty).join(', ')}` : '') + (this.random.length ? `\nrandom: ${this.random.map(pretty).join(', ')}` : '')
  }
}
class BP_ForceJob_C extends META_BaseAction { // not forcejobbaseaction
  init(o) {
    super.init(o)
    this.job = o.Properties?.JobID
    this.goal = o.Properties?.GoalID
    this.crew = o.Properties?.CrewForJob ?? [] // [EIGS_CharacterID]
    this.forceFill = o.Properties?.CharactersForMission ?? 'EMETA_ForceJobFillCharacter::Manual' // EMETA_ForceJobFillCharacter
    this.poolAmount = o.Properties?.AmountOfCharacterFromPool ?? 0
    this.usingCrew = o.Properties?.IsTemporaryCrew // EMETA_UsingCrewInGraph
  }
  details() {
    return (this.job ? `\njob: ${prettyRef(this.job)}` : '') + (this.goal ? `\ngoal: ${prettyRef(this.goal)}` : '') + `\ncrew: ${this.crew.map(pretty).join(', ')} + ${this.poolAmount} (${pretty(this.forceFill)}, ${pretty(this.usingCrew)})`
  }
}
class BP_SetCrewRandEventAsReady_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.partner = o.Properties?.Partner
    this.event = o.Properties?.CrewEventID
    this.graph = o.Properties?.Graph
  }
  linkedAssets() {
    return [this.graph]
  }
  details() {
    return prettyTag(this.event) + '\npartner: ' + pretty(this.partner) + '\ngraph: ' + prettyAsset(this.graph)
  }
}
class BP_RemoveHeisterFromCampaign_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.character = o.Properties?.CharacterID
  }
  details() {
    return pretty(this.character)
  }
}
class BP_HeisterHasTraits_C extends META_BaseHeisterCondition {
  init(o) {
    super.init(o)
    this.traits = o.Properties?.Traits ?? []
    this.operator = o.Properties?.Operator
  }
  details() {
    return this.traits.map(pretty).join(' ' + pretty(this.operator) + ' ')
  }
}
class BP_HeisterUnique_C extends META_BaseHeisterCondition {
  details() {
    return ''
  }
}
class BP_HeisterParticipatesInEvent_C extends META_BaseHeisterCondition {
  init(o) {
    super.init(o)
    this.event = o.Properties?.EventID ?? {TagName: 'None'}
  }
  details() {
    return prettyTag(this.event)
  }
}
class BP_HeisterCompletedAmountOfMissions_C extends META_BaseHeisterCondition {
  init(o) {
    super.init(o)
    this.operator = o.Properties?.Operator ?? 'EMETA_ConditionOperator::GreaterOrEqual'
    this.amount = o.Properties?.Amount
  }
  details() {
    return pretty(this.operator) + ' ' + this.amount
  }
}
class BP_ElapsedTimeAfterHeisterStateChange_C extends META_BaseHeisterCondition {
  init(o) {
    super.init(o)
    this.prevState = o.Properties?.PrevState
    this.targetState = o.Properties?.TargetState
    this.operator = o.Properties?.Operator
    this.days = o.Properties?.ElapsedDaysAmount
  }
  details() {
    return pretty(this.operator) + ' ' + this.days + ' day(s)' + (this.prevState ? '\nprevious state: ' + pretty(this.prevState) : '') + (this.targetState ? '\ntarget state: ' + pretty(this.targetState) : '')
  }
}
class BP_MissionWasFinishedWithAmbushResult_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.mission = o.Properties?.MissionID
    this.result = o.Properties?.AmbushResult
  }
  details() {
    return `${prettyTag(this.mission)}: ${pretty(this.result)}`
  }
}
class BP_TagIsDivisible_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.tag = o.Properties?.Tag ?? {TagName: 'None'}
    this.divisor = o.Properties?.Divisor ?? 1
  }
  details() {
    return `${prettyTag(this.tag)} / ${this.divisor}`
  }
}
class BP_ResultByTagChance_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.tag = o.Properties?.TagChance ?? {TagName: 'None'}
  }
  details() {
    return prettyTag(this.tag)
  }
}
class BP_CheckConditionForHQStorm_C extends META_BaseCondition {
  details() {return ''}
}
class BP_CheckRandomEvent_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.event = o.Properties?.['Event ID'] ?? {TagName: 'None'}
  }
  details() {
    return prettyTag(this.event)
  }
}
class BP_DoesHeisterHaveStateFromList_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.character = o.Properties?.UniqCharacterId ?? 'EIGS_CharacterID::Char_Unknown'
    this.list = o.Properties?.StatesList ?? []
  }
  details() {
    return pretty(this.character) + '\none of:' + this.list.map(pretty).join(', ')
  }
}
class BP_WasHeisterAssignedToCompletedJob_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.character = o.Properties?.HeisterID
    this.mission = o.Properties?.MissionID
  }
  details() {
    return pretty(this.character) + '\n' + prettyRef(this.mission)
  }
}
class BP_AreInCrewHeistersWithState_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    // TODO: default state
    this.state = o.Properties?.State
    this.onlyUnique = o.Properties?.CheckOnlyUniqueHeisters ?? false
  }
  details() {
    return pretty(this.state) + (this.onlyUnique ? ' (only unique)' : '')
  }
}
class BP_ForceJobForEvent_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.job = o.Properties.JobID
    this.isTemporaryCrew = o.Properties.IsTemporaryCrew
  }
  details() {
    return `\n${prettyRef(this.job)}\n– temporary crew: ${this.isTemporaryCrew}`
  }
}
class BP_ForceJobExecution_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.job = o.Properties?.JobID
    this.result = o.Properties?.ForcedResult
    this.useUiResult = o.Properties?.UseResultWhichWasChosenOnUI ?? false
  }
  details() {
    return `\n${prettyRef(this.job)}\nresult: ${pretty(this.result)}` + (this.useUiResult ? '\nuse UI result' : '')
  }
}
class META_JobResultCallbackByID extends BP_Base_C {
  init(o) {
    super.init(o)
    this.nextNodes = fixMap(o.Properties.NextNodesMap)
  }
  edgeLabel(out) {
    return Object.entries(this.nextNodes)
      .filter(([_, id]) => out.id === id)
      .map(([res]) => pretty(res))
      .join(', ')
  }
}
class BP_JobResultCallbackByID_C extends META_JobResultCallbackByID {
  init(o) {
    super.init(o)
    this.job = o.Properties.Job
  }
  details() {
    return `\n${prettyRef(this.job)}`
    // TODO
  }
}
class BP_LootEventCallback_C extends META_JobResultCallbackByID { // inheritance is not a typo
  details() {
    return ''
    // TODO
  }
}
class BP_CutsceneCondition_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.cutscene = o.Properties.CutsceneID
  }
  details() {
    return `\n${pretty(this.cutscene.Key)}`
  }
}
class BP_PlayerHasRespect_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.operator = o.Properties.Operator
    this.respect = o.Properties.RespectLvl
  }
  details() {
    return `${pretty(this.operator)} ${pretty(this.respect)}`
  }
}
class BP_PlayerHasMoneyForAsset_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.asset = o.Properties?.AssetTag ?? {TagName: 'None'}
  }
  details() {
    return prettyTag(this.asset)
  }
}
class META_CallbackWithActions extends BP_Base_C {}
class BP_BossLevelCallback_C extends META_CallbackWithActions {
  init(o) {
    super.init(o)
    this.lowerBound = o.Properties.Amount?.LowerBound?.Value ?? 1
    this.upperBound = o.Properties.Amount?.UpperBound?.Value ?? 1
    this.operator = o.Properties?.ConditionOperator ?? DEFAULT_CONDITION_EXPR_OPERATOR
  }
  details() {
    return `≥ ${this.lowerBound} ${pretty(this.operator)} ≤ ${this.upperBound}`
  }
}
class BPA_CallbackWithActionsBase_C extends META_CallbackWithActions {
  init(o) {
    super.init(o)
    this.operator = o.Properties?.ConditionOperator ?? DEFAULT_CONDITION_EXPR_OPERATOR
  }
}
class BP_GangEliminatedCallback_C extends BPA_CallbackWithActionsBase_C {
  init(o) {
    super.init(o)
    this.gang = o.Properties?.Gang
  }
  details() {
    return pretty(this.gang)
  }
}
class BP_TurfChangeCallback_C extends BPA_CallbackWithActionsBase_C {
  init(o) {
    super.init(o)
    this.amount = o.Properties?.Amount ?? 1
    this.to = o.Properties?.ToGangs ?? []
    this.from = o.Properties?.PrevGangs ?? []
  }
  details() {
    return this.amount + '\nfrom: ' + this.from.map(pretty).join(', ') + '\nto: ' + this.to.map(pretty).join(', ')
  }
}
class BP_ChangeBossLevel_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.by = o.Properties.ChangeBy
  }
  details() {
    return `by ${this.by}`
  }
}
class BP_ChangePlayersArmyAmount_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.value = o.Properties?.Value ?? 0
    this.type = o.Properties?.ExpressionType ?? DEFAULT_ACTION_EXPRESSION_TYPE
  }
  details() {
    return pretty(this.type) + ' ' + this.value
  }
}
class BP_ChangeLootByVariable_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.loot = o.Properties?.LootTag ?? {TagName: 'None'}
    this.value = o.Properties?.ValueTag ?? {TagName: 'None'}
    this.random = o.Properties?.RandomTag
    this.type = o.Properties?.ExpressionType ?? DEFAULT_ACTION_EXPRESSION_TYPE
  }
  details() {
    return pretty(this.type) + '\n' + prettyTag(this.value) + '\n' + prettyTag(this.loot) + (this.random ? '\n' + prettyTag(this.random) : '')
  }
}
class BP_ChangeLootByValue_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.loot = o.Properties?.LootTag ?? {TagName: 'None'}
    this.value = o.Properties?.Value ?? 0
    this.randomLow = o.Properties?.ExtraRandomValue?.LowerBound?.Value ?? 0
    this.randomLowInclusive = (o.Properties?.ExtraRandomValue?.LowerBound?.Type ?? 'ERangeBoundTypes::Inclusive') === 'ERangeBoundTypes::Inclusive'
    this.randomHigh = o.Properties?.ExtraRandomValue?.UpperBound?.Value ?? 0
    this.randomHighInclusive = (o.Properties?.ExtraRandomValue?.UpperBound?.Type ?? 'ERangeBoundTypes::Inclusive') === 'ERangeBoundTypes::Inclusive'
  }
  details() {
    return pretty(this.loot) + '\n' + prettyTag(this.value) + (this.randomLow !== 0 ? this.randomLow === this.randomHigh ? ` + ${this.randomLow}` : ` + ${this.randomLowInclusive ? '[' : '('}${this.randomLow}, ${this.randomHigh}${this.randomHighInclusive ? ']' : ')'}` : '')
  }
}
class BP_SetLoadingScreen_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.screenText = o.Properties.ScreenText
  }
  details() {
    return pretty(this.screenText.Key)
  }
}
class BP_GraphHasState_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.graph = o.Properties.Graph
    this.result = o.Properties.Result
  }
  linkedAssets() {
    return [this.graph]
  }
  details() {
    return pretty(this.result) + ' in ' + prettyAsset(this.graph)
  }
}
class BP_CheckPersistentTag_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.tag = o.Properties.Tag
    this.value = o.Properties.TagValue ?? 0
    this.operator = o.Properties.Operator ?? DEFAULT_CONDITION_OPERATOR
  }
  details() {
    return prettyTag(this.tag) + ' ' + pretty(this.operator) + ' ' + this.value
  }
}
class BP_CurrentCrewCount_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.withBoss = o.Properties.WithBoss ?? false
    this.withUnique = o.Properties.WithUnique ?? false
    this.value = o.Properties.Value ?? 0
    this.operator = o.Properties.Operator ?? DEFAULT_CONDITION_OPERATOR
  }
  details() {
    return pretty(this.operator) + ' ' + this.value + (this.withBoss || this.withUnique ? '\nincluding ' + [this.withBoss ? 'boss' : '', this.withUnique ? 'unique' : ''].filter(x => x).join(', ') : '')
  }
}
class BP_ResetTurfCallback_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.node = o.Properties?.CallbackNodeID ?? 0
  }
  details() {
    return '#' + this.node
  }
}
class BP_KillDetective_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.detective = o.Properties?.Detective
  }
  details() {
    return prettyRef(this.detective)
  }
}
class BP_AddPlotlineAsset_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.tag = o.Properties?.Tag ?? {TagName: 'None'}
  }
  details() {
    return prettyTag(this.tag)
  }
}
class BP_RemovePlotlineAsset_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.tag = o.Properties?.Tag ?? {TagName: 'None'}
  }
  details() {
    return prettyTag(this.tag)
  }
}
class BP_AddJobParameter_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.job = o.Properties.JobID
    this.parameter = o.Properties.JobParameter ?? {TagName: 'None'}
    this.value = o.Properties.NewValue ?? 0
  }
  details() {
    return prettyRef(this.job) + '\n' + prettyTag(this.parameter) + ' = ' + this.value
  }
}
class BP_AddJobParameterByVariable_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.job = o.Properties.JobID
    this.parameter = o.Properties?.JobParameter ?? {TagName: 'None'}
    this.variable = o.Properties.VariableTag ?? {TagName: 'None'}
  }
  details() {
    return prettyRef(this.job) + '\n' + prettyTag(this.parameter) + ' = ' + prettyTag(this.variable)
  }
}
class BP_AddJobParameterByOutParameter_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.job = o.Properties?.JobID
    this.param = o.Properties?.inParameter ?? {TagName: 'None'}
    this.outJob = o.Properties?.OutgoingJobID
    this.outParam = o.Properties?.outParameter ?? {TagName: 'None'}
  }
  details() {
    return '\nin: ' + prettyRef(this.job) + ': ' + prettyTag(this.param) + '\nout: ' + prettyRef(this.outJob) + ': ' + prettyTag(this.outParam)
  }
}
class BP_IsGoalFinished_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.goal = o.Properties.Goal
  }
  details() {
    return prettyAsset(this.goal)
  }
}
class BP_AddGoalToPool_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.goal = o.Properties.GoalID
  }
  linkedAssets() {
    return [this.goal]
  }
  details() {
    return prettyAsset(this.goal)
  }
}
class BP_AddGraph_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.graph = o.Properties.Graph
    // TODO: Status
    // TODO: NeedExecute
  }
  linkedAssets() {
    return [this.graph]
  }
  details() {
    return prettyAsset(this.graph)
  }
}
class BP_RemoveGraphFromPool_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.graph = o.Properties?.Graph
    this.result = o.Properties?.GraphResult ?? 'EMETA_GoalStatus::Failed'
    // TODO: GraphResult
  }
  linkedAssets() {
    return [this.graph]
  }
  details() {
    return prettyAsset(this.graph) + '\nresult: ' + pretty(this.result)
  }
}
class META_MovieCondition extends META_BaseCondition {}
class BP_MovieCondition_C extends META_MovieCondition {
  init(o) {
    super.init(o)
    this.movie = o.Properties?.Movie
    // TODO
  }
  details() {
    return prettyRef(this.movie)
  }
}
class BP_UnlockInMultiplayer_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.reward = o.Properties.RewardID
  }
  details() {
    return prettyTag(this.reward)
  }
}
class BP_RemoveGoalFromPool_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.goal = o.Properties.Goal
  }
  linkedAssets() {
    return [this.goal]
  }
  details() {
    return prettyAsset(this.goal)
  }
}
class BP_AddUniqHeisterToMarketPool_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.character = o.Properties.UniqCharacterId
  }
  details() {
    return pretty(this.character)
  }
}
class BP_AddUniqHeisterToCrew_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.character = o.Properties.UniqCharacterId
  }
  details() {
    return pretty(this.character)
  }
}
class BP_PlayerHasSpecificHeister_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.character = o.Properties.CharacterID.ID
  }
  details() {
    return pretty(this.character)
  }
}
class BP_CheckGoalStatus_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.goal = o.Properties.Goal
    this.status = o.Properties.Status
  }
  linkedAssets() {
    return [this.goal]
  }
  details() {
    return prettyAsset(this.goal) + ' is ' + pretty(this.status)
  }
}
class BP_IsThereTagInPlotlinesDebugList_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.tag = o.Properties?.Tag
  }
  details() {
    return prettyTag(this.tag)
  }
}
class BP_IsCampaignDebugModeOn_C extends META_BaseCondition {
  details() {
    return ''
  }
}
class BP_ChangePlayersArmyTier_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.amount = o.Properties.Amount
  }
  details() {
    return this.amount
  }
}
class BP_IsGangAlive_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.gang = o.Properties.Gang
  }
  details() {
    return pretty(this.gang)
  }
}
class BP_SetGangStrategy_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.gang = o.Properties.Gang
    this.strategy = o.Properties.NewStrategy
  }
  details() {
    return pretty(this.gang) + ' = ' + pretty(this.strategy)
  }
}
class BP_SetGangArmyTier_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.gang = o.Properties.Gang
    this.tier = o.Properties.Tier
  }
  details() {
    return pretty(this.gang) + ' = ' + pretty(this.tier)
  }
}
class BP_ChangeAiBossStrengthWithIntensity_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.gang = o.Properties.Gang
    this.intensity = o.Properties.Intensity
    this.days = o.Properties.DurationInDays
    this.turfWarsToReset = o.Properties.AmountOfAttacksOrDefensesToResetEffect
  }
  details() {
    return '\n' + pretty(this.gang) + ' = ' + pretty(this.intensity) + '\nfor ' + this.days + ' day(s) or ' + this.turfWarsToReset + ' war(s)'
  }
}
class BP_SetGraphVariable_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.var = o.Properties?.Var ?? {TagName: 'None'}
    this.value = o.Properties?.NewValue ?? 0
  }
  details() {
    return prettyTag(this.var) + ' = ' + this.value
  }
}
class BP_ChangeGraphVariableByValue_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.var = o.Properties?.VarName ?? {TagName: 'None'}
    this.by = o.Properties?.ChangeBy ?? 0
  }
  details() {
    return prettyTag(this.var) + ' by ' + this.by
  }
}
class BP_ChangeGraphVariableByVariable_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.var = o.Properties?.VarName ?? {TagName: 'None'}
    this.by = o.Properties?.ChangeByVar ?? {TagName: 'None'}
    this.type = o.Properties?.ExpressionType ?? DEFAULT_ACTION_EXPRESSION_TYPE
  }
  details() {
    return pretty(this.type) + ' ' + prettyTag(this.var) + ' by ' + prettyTag(this.by)
  }
}
class BP_ChangeTilesOwner_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.targetGang = o.Properties?.TargetGang
    this.newOwner = o.Properties?.NewOwner
    this.amount = o.Properties?.Amount ?? 1
    this.minKept = o.Properties?.MinimalAmountOfTilesTargetGangShouldKeep ?? 1
  }
  details() {
    return `${this.amount} from ${pretty(this.targetGang)} to ${prettyTag(this.newOwner)} (keeping ≥${this.minAmount})`
  }
}
class BP_ChangeInvestigationValue_C extends META_BaseAction {
  init(o) {
    super.init(o)
    // TODO: double check the defaults
    this.operation = o.Properties?.Operation ?? DEFAULT_UNARY_OPERATION
    this.by = o.Properties?.ChangeBy ?? 'EMETA_PoliceInvestigationChangeForGraph::Small'
  }
  details() {
    return pretty(this.operation) + ' by ' + pretty(this.by)
  }
}
class BP_TaskHasStatus_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.task = o.Properties.TaskNodeID
    this.status = o.Properties.Status
  }
  details() {
    // TODO: extra graph edge
    return '#' + this.task + ' = ' + pretty(this.status)
  }
}
class BP_SetTaskStatus_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.task = o.Properties.TaskNodeID
    this.status = o.Properties.TaskStatus
  }
  details() {
    // TODO: extra graph edge
    return '#' + this.task + ' = ' + pretty(this.status)
  }
}
class BP_RemoveTask_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.task = o.Properties.TaskNodeID
  }
  details() {
    return '#' + this.task
  }
}
class BP_CheckMissionOutParameter_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.mission = o.Properties?.MissionID
    this.parameter = o.Properties?.Parameter
    this.operator = o.Properties?.Operator ?? DEFAULT_CONDITION_OPERATOR
    this.value = o.Properties?.Value ?? 0 // TODO: 0?
  }
  details() {
    return '\n' + prettyRef(this.mission) + ':\n' + prettyTag(this.parameter) + ' ' + pretty(this.operator) + ' ' + pretty(this.value)
  }
}
class BP_SetDurationOfSpecialArmyTierForGang_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.gang = o.Properties?.Gang
    this.value = o.Properties?.Value
  }
  details() {
    return pretty(this.gang) + ': ' + this.value + ' day(s)'
  }
}
class BP_RemoveSpecialArmyTierForGang_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.gang = o.Properties.Gang
  }
  details() {
    return pretty(this.gang)
  }
}
class BP_EradicateGang_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.gang = o.Properties.Gang
  }
  details() {
    return pretty(this.gang)
  }
}
class BP_ResetAiBossStrengthEffects_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.gang = o.Properties.Gang
  }
  details() {
    return pretty(this.gang)
  }
}
class BP_AddGangToAttitudeList_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.list = o.Properties.AttitudeList
    this.owner = o.Properties.OwnerGang
    this.target = o.Properties.TargetGang
    this.duration = o.Properties.Duration ?? 1
  }
  details() {
    // TODO: list
    return this.duration + ' day(s)\n' + pretty(this.owner) + ' toward ' + pretty(this.target)
  }
}
class BP_RemoveGangFromAttitudeList_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.list = o.Properties.AttitudeList
    this.owner = o.Properties.OwnerGang
    this.target = o.Properties.TargetGang
  }
  details() {
    // TODO: list
    return pretty(this.owner) + ' toward ' + pretty(this.target)
  }
}
class BP_IsThereGangInAttitudeList_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.owner = o.Properties.OwnerGang
    this.target = o.Properties.TargetGang
    // TODO: this.list = o.Properties.AttitudeList
  }
  details() {
    return '\n' + pretty(this.owner) + ' toward ' + pretty(this.target)
  }
}
class BP_GangHasArmyTier_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.gang = o.Properties.Gang
    this.operator = o.Properties.Operator
    this.tier = o.Properties.Tier
  }
  details() {
    return pretty(this.gang) + ' ' + pretty(this.operator) + ' ' + pretty(this.tier)
  }
}
class BP_GangHasTilesCount_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.gang = o.Properties.Gang
    this.operator = o.Properties.Operator ?? 'EMETA_ConditionOperator::GreaterOrEqual'
    this.count = o.Properties.Count
  }
  details() {
    return pretty(this.gang) + ' ' + pretty(this.operator) + ' ' + pretty(this.count)
  }
}
class BP_JobStartExecutionCallback_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.job = o.Properties?.JobId
    this.condition = o.Properties?.ConditionOperator ?? DEFAULT_CONDITION_EXPR_OPERATOR
    this.executeManually = o.Properties?.bShouldJobBeExecutedManuallyFromGraphs ?? false
  }
  details() {
    return prettyRef(this.job) + ' (' + pretty(this.condition) + ')' + (this.executeManually ? '\nexecute manually' : '')
  }
}
class BP_SpawnJob_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.job = o.Properties?.Job
    this.difficulty = o.Properties?.DifficultyOverride
  }
  details() {
    // TODO
    return prettyRef(this.job) + (this.difficulty ? '\ndifficulty: ' + pretty(this.difficulty) : '')
  }
}
class META_TaskCondition extends BP_Base_C {
  init(o) {
    super.init(o)
    this.title = o.Properties.TaskTitle
    this.task = o.Properties.TaskId
    this.needType = o.Properties?.NeedValueType
    this.needTag = o.Properties?.NeedTag
    this.needValue = o.Properties?.NeedValue
    this.optional = o.Properties?.bOptional ?? false
    // TODO: ProcessValue, Status === 'EMETA_TaskStatus::Success'
  }
  needDetails() {
    return this.needType === 'EMETA_NeedValueType::Tag' ? prettyTag(this.needTag) : String(this.needValue)
  }
  taskDetails() {
    return '\n' + pretty(this.title.Key) + (this.optional ? ' (optional)' : '') + (this.task ? ' #' + this.task : '')
  }
}
class BP_BaseAmountTask_C extends META_TaskCondition {
  details() {
    return this.needDetails() + this.taskDetails()
  }
}
class BP_PlayerNeedsToHaveCash_C extends BP_BaseAmountTask_C {}
class BP_PlayerNeedsToHaveTurfsAmount_C extends BP_BaseAmountTask_C {}
class BP_PlayerNeedsToHaveArmyAmount_C extends BP_BaseAmountTask_C {
  init(o) {
    super.init(o)
    this.availableOnly = o.Properties?.AvailableOnly ?? false
  }
  needDetails() {
    return super.needDetails() + (this.availableOnly ? ' available' : ' total')
  }
}
class BP_PlayerNeedsToHaveMoneyForAsset_C extends BP_BaseAmountTask_C {
  init(o) {
    super.init(o)
    this.needType = o.Properties?.NeedValueType ?? 'EMETA_NeedValueType::Tag'
  }
}
class BP_PlayerNeedsToHaveLootAmount_C extends BP_BaseAmountTask_C {
  init(o) {
    super.init(o)
    this.loot = o.Properties?.LootType ?? {TagName: 'None'}
  }
  needDetails() {
    return prettyTag(this.loot) + ' ' + super.needDetails()
  }
}
class BP_FictiousTaskForOverrideFlow_C extends BP_BaseAmountTask_C {
  details() {
    return this.taskDetails()
  }
}
class BP_PlayerNeedsToWaitDays_C extends BP_BaseAmountTask_C {
  init(o) {
    super.init(o)
    // TODO: DayTime
  }
}
class BP_CheckJobResult_C extends BP_BaseAmountTask_C {
  init(o) {
    super.init(o)
    this.job = o.Properties?.Job
  }
  details() {
    // TODO: wrong? or operator?
    return prettyRef(this.job) + '\n' + super.details()
  }
}
class BP_ChangePlayerCash_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.cash = o.Properties?.CashTag
    this.minimum = o.Properties?.MinimumBound
    this.type = o.Properties?.ExpressionType ?? DEFAULT_ACTION_EXPRESSION_TYPE
    this.nonNegative = o.Properties?.NonNegative ?? false // TODO: unknown
  }
  details() {
    // TODO: nonNegative
    return pretty(this.type) + ' ' + prettyTag(this.cash) + (this.minimum ? ' (min ' + prettyTag(this.minimum) + ')' : '')
  }
}
class BP_IsThereAvailableJob_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.job = o.Properties.JobID
  }
  details() {
    return prettyRef(this.job)
  }
}
class BP_ForceLoan_C extends BP_Base_C {
  init(o) {
    super.init(o)
    this.loanAmount = o.Properties?.LoanAmount
    this.interestMultiplier = o.Properties?.InterestMultiplier
  }
  details() {
    return '\n' + prettyTag(this.loanAmount) + '\ninterest mul: ' + this.interestMultiplier
  }
}
class BP_IsPlayerInBankruptState_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.days = o.Properties?.DaysAmountInBankruptState ?? 0
    this.operator = o.Properties?.Operator ?? DEFAULT_CONDITION_OPERATOR
    // TODO: UseDaysAmountAfterWhichHeitersWillStartLeave
  }
  details() {
    return pretty(this.operator) + ' ' + pretty(this.days)
  }
}
class BP_PlayerHasEmptyStash_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.threshold = o.Properties?.LootThreshold ?? {TagName: 'None'}
  }
  details() {
    return prettyTag(this.threshold)
  }
}
class BP_PlayerHasLoot_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.operator = o.Properties?.Operator ?? DEFAULT_CONDITION_OPERATOR
    this.worth = o.Properties?.WorthTag ?? {TagName: 'None'}
    this.loot = o.Properties?.Loot ?? {TagName: 'None'}
  }
  details() {
    return prettyTag(this.loot) + ' ' + pretty(this.operator) + ' ' + prettyTag(this.worth)
  }
}
class BP_AllTaskCompleted_C extends META_BaseCondition {
  details() {
    return ''
  }
}
class BP_CheckLoan_C extends META_BaseCondition {
  details() {
    return ''
  }
}
class BP_RemoveJob_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.job = o.Properties.Job
  }
  details() {
    return prettyRef(this.job)
  }
}
class BP_ChangeTaskProcessValueBy_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.task = o.Properties?.TaskNodeId ?? 0
    this.by = o.Properties?.ByValue ?? 0
  }
  details() {
    return `#${this.task} by ${this.by}`
  }
}
class BP_SwitchToScreen_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.screen = o.Properties?.ScreenTag ?? {TagName: 'MetaMenu.Menu.Map'}
  }
  details() {
    return prettyTag(this.screen)
  }
}
class BP_ChangeCashForPartner_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.partner = o.Properties?.Partner
    this.cash = o.Properties?.CashTag ?? {TagName: 'None'}
    this.type = o.Properties?.ExpressionType ?? DEFAULT_ACTION_EXPRESSION_TYPE
  }
  details() {
    return pretty(this.partner) + '\n' + pretty(this.type) + ' ' + prettyTag(this.cash)
  }
}
class BP_ChangeCashForGang_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.gang = o.Properties?.Gang
    this.cash = o.Properties?.CashTag ?? {TagName: 'None'}
    this.type = o.Properties?.ExpressionType ?? DEFAULT_ACTION_EXPRESSION_TYPE
  }
  details() {
    return pretty(this.gang) + '\n' + pretty(this.type) + ' ' + prettyTag(this.cash)
  }
}
class BP_CheckHeistersAmountOnEvent_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.event = o.Properties?.EventID ?? {TagName: 'None'}
    this.operator = o.Properties?.Operator ?? 'EMETA_ConditionOperator::GreaterOrEqual'
    this.amount = o.Properties?.Amount ?? 1
  }
  details() {
    return prettyTag(this.event) + ' ' + pretty(this.operator) + ' ' + this.amount
  }
}
class BP_ReturnCurrentGoalBackToPool_C extends META_BaseAction {
  details() {
    return ''
  }
}
class BP_IsThereParameterInJobWithValue_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.job = o.Properties?.JobID
    this.param = o.Properties?.Parameter
    this.value = o.Properties?.ParameterValue
    this.evenWhenNotAvailable = o.Properties?.['CheckEvenWhen JobIsNotAvailableOnMap']
  }
  details() {
    // TODO: type
    return '\n' + prettyRef(this.job) + ': ' + prettyTag(this.param) + ' = ' + this.value + (this.evenWhenNotAvailable ? '\neven when not available on map' : '')
  }
}
class BP_UnlockPlotlineAsset_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.tag = o.Properties.Tag.TagName
    this.supressNotification = o.Properties.SuppressNotification ?? false
  }
  details() {
    // TODO: type
    return pretty(this.tag) + (this.supressNotification ? '\nsuppress notification: yes' : '')
  }
}
class BP_PlayerOwnsPlotlineAsset_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.tag = o.Properties.Tag.TagName
  }
  details() {
    // TODO: type
    return pretty(this.tag)
  }
}
class BP_PlayerHasCash_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.operator = o.Properties?.Operator ?? DEFAULT_CONDITION_OPERATOR
    this.tag = o.Properties?.CashCompareTag ?? {TagName: 'None'}
  }
  details() {
    return pretty(this.operator) + ' ' + prettyTag(this.tag)
  }
}
class BP_GangHasCash_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.gang = o.Properties?.Gang
    this.operator = o.Properties?.Operator ?? DEFAULT_CONDITION_OPERATOR
    this.tag = o.Properties?.CashCompareTag ?? {TagName: 'None'}
  }
  details() {
    return pretty(this.gang) + ' ' + pretty(this.operator) + ' ' + prettyTag(this.tag)
  }
}
class BP_RefreshMoneymakingMissions_C extends META_BaseAction {
  details() {
    return ''
  }
}
class BP_ShowStoryNotification_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.notification = o.Properties.Notification
  }
  details() {
    return prettyAsset(this.notification)
  }
}
class BP_ToggleFeatureBaseAction_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.enabled = o.Properties?.Enabled ?? true
  }
  details() {
    return this.enabled ? 'on' : 'off'
  }
}
class BP_ToggleTurfwarMissionType_C extends BP_ToggleFeatureBaseAction_C {
  init(o) {
    super.init(o)
    this.type = o.Properties.TurfwarType
  }
  details() {
    return super.details() + '\n' + pretty(this.type)
  }
}
class BP_ToggleGangsMovementOnMap_C extends BP_ToggleFeatureBaseAction_C {}
class BP_ToggleHeisterPoolRefresh_C extends BP_ToggleFeatureBaseAction_C {}
class BP_ToggleUniqueCharactersRandomPool_C extends BP_ToggleFeatureBaseAction_C {}
class BP_ToggleBuyingWeapons_C extends BP_ToggleFeatureBaseAction_C {}
class BP_ToggleMarketHireArmyEvent_C extends BP_ToggleFeatureBaseAction_C {}
class BP_ToggleMarketLootEvents_C extends BP_ToggleFeatureBaseAction_C {}
class BP_ToggleMarketWeaponEvent_C extends BP_ToggleFeatureBaseAction_C {}
class BP_ToggleRandEventsSystem_C extends BP_ToggleFeatureBaseAction_C {}
class BP_TogglePlotlineSystem_C extends BP_ToggleFeatureBaseAction_C {}
class BP_ToggleStormPoliceUnits_C extends BP_ToggleFeatureBaseAction_C {}
class BP_UnlockFeature_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.tag = o.Properties.Tag?.TagName ?? 'Meta.Intro.Unlocks'
    this.dialogue = o.Properties.DialogueID?.Key ?? 'ID_None'
    this.silent = o.Properties.Silent ?? false
    // TODO: these
    this.unlockWithChildren = o.Properties.UnlockWithChildren
    this.playInstantly = o.Properties.PlayInstantly
    this.delayUnlock = o.Properties.DelayUnlock
  }
  details() {
    return (this.silent ? 'silent' : '') + '\n' + pretty(this.tag) + (this.dialogue !== 'ID_None' ? '\ndialogue: ' + pretty(this.dialogue) : '')
  }
}
class BP_GraphConditionByVariable_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.var = o.Properties.GraphVariable
    this.operator = o.Properties.Operator ?? DEFAULT_CONDITION_OPERATOR
    this.value = o.Properties.CompareValue ?? 0
  }
  details() {
    return prettyTag(this.var) + ' ' + pretty(this.operator) + ' ' + pretty(this.value)
  }
}
class BP_IsHeisterRemovedFromCampaign_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.character = o.Properties?.CharacterID
  }
  details() {
    return pretty(this.character)
  }
}
class BP_HeisterDidAmountOfMission_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.heister = o.Properties?.HeisterID
    this.amount = o.Properties?.MissionAmout ?? 0
    this.operator = o.Properties?.Operator ?? DEFAULT_CONDITION_OPERATOR
  }
  details() {
    return pretty(this.heister) + ' ' + pretty(this.operator) + ' ' + this.amount
  }
}
class BP_WasMissionCompletedInStealth_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.mission = o.Properties.MissionID
  }
  details() {
    return prettyRef(this.mission)
  }
}
class BP_CurrentDay_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.operator = o.Properties.Operator ?? DEFAULT_CONDITION_OPERATOR
    this.day = o.Properties.Day
  }
  details() {
    return pretty(this.operator) + ' ' + this.day
  }
}
class BP_PercentageOfHeistersWithCharacteristics_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.operator = o.Properties?.BooleanOperatorBetweenCharacteristics ?? DEFAULT_CONDITION_EXPR_OPERATOR
    this.bad = o.Properties?.WithBadTraits ?? false
    this.good = o.Properties?.WithGoodTraits ?? false
    this.mood = o.Properties?.Mood ?? DEFAULT_CHARACTER_MOOD
    this.minPercent = o.Properties?.MinPercentageOfSuitableHeisters ?? 0.5
  }
  details() {
    return ' ≥ ' + percent(this.minPercent) + [
      this.good && 'good',
      this.bad && 'bad',
      pretty(this.mood)
    ].filter(x => x).join(' ' + pretty(this.operator) + ' ')
  }
}
class BP_CheckHeatState_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.operator = o.Properties.Operator ?? DEFAULT_CONDITION_OPERATOR
    this.heat = o.Properties.Heat
  }
  details() {
    return pretty(this.operator) + ' ' + pretty(this.heat)
  }
}
class BP_CheckGenericHeistersFuneralCooldown_C extends META_BaseCondition {
  details() {
    return ''
  }
}
class BP_CheckInvestigationState_C extends META_BaseCondition {
  init(o) {
    super.init(o)
    this.operator = o.Properties.Operator ?? DEFAULT_CONDITION_OPERATOR
    this.percent = o.Properties.InvestigationValueInPercent
  }
  details() {
    return pretty(this.operator) + ' ' + this.percent + '%'
  }
}
class BP_SetPersistentTag_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.tag = o.Properties?.Tag
    this.value = o.Properties?.NewValue
  }
  details() {
    return prettyTag(this.tag) + ' = ' + this.value
  }
}
class BP_ChangePersistentTag_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.tag = o.Properties?.Tag ?? {TagName: 'Meta.Persistent'}
    this.value = o.Properties?.ByValue ?? 1
  }
  details() {
    return prettyTag(this.tag) + ' by ' + this.value
  }
}
class BP_ForceTrainingLootEvent_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.loot = o.Properties?.['In Loot Tags Override'] ?? {TagName: 'Meta.Persistent'}
  }
  details() {
    return prettyTag(this.loot)
  }
}
class BP_UnlockAchievement_C extends META_BaseAction {
  init(o) {
    super.init(o)
    this.achievement = o.Properties?.AchievementID ?? {TagName: 'None'}
  }
  details() {
    return prettyTag(this.achievement)
  }
}

types = {
  META_StoryGraph,
  META_RootNode_SG,
  META_ActionsNode_SG,
  META_CallbackNode_SG,
  META_RandomBranchNode_SG,
  META_SwitchNode_SG,
  META_BranchNode_SG,
  META_SubGraphNode_SG,
  META_LoopBranchNode,
  META_ConditionsNode_SG,
  META_ParallelizationNode_SG,
  META_EndNode_SG,
  META_TimerNode_SG,
  META_MediaNode_SG,
  META_TaskNode_SG,
  META_UnaryOperationNode_SG,
  BP_ChangeHeisterMood_C,
  BP_KillHeister_C,
  BP_AddTraitToHeister_C,
  BP_SetHeisterState_C,
  BP_ForceJob_C,
  BP_ForceJobForEvent_C,
  BP_ForceJobExecution_C,
  BP_RemoveTraitFromHeister_C,
  BP_JobResultCallbackByID_C,
  BP_CutsceneCondition_C,
  BP_PlayerHasRespect_C,
  BP_BossLevelCallback_C,
  BP_ChangeBossLevel_C,
  BP_SetLoadingScreen_C,
  BP_GraphHasState_C,
  BP_CheckPersistentTag_C,
  BP_IsThereTagInPlotlinesDebugList_C,
  BP_IsCampaignDebugModeOn_C,
  BP_AddJobParameter_C,
  BP_IsGoalFinished_C,
  BP_AddGoalToPool_C,
  BP_CheckGoalStatus_C,
  BP_IsGangAlive_C,
  BP_SetGangStrategy_C,
  BP_ChangeAiBossStrengthWithIntensity_C,
  BP_SetGraphVariable_C,
  BP_SetTaskStatus_C,
  BP_RemoveTask_C,
  BP_CheckMissionOutParameter_C,
  BP_SetDurationOfSpecialArmyTierForGang_C,
  BP_RemoveSpecialArmyTierForGang_C,
  BP_TaskHasStatus_C,
  BP_EradicateGang_C,
  BP_ResetAiBossStrengthEffects_C,
  BP_JobStartExecutionCallback_C,
  BP_SpawnJob_C,
  BP_FictiousTaskForOverrideFlow_C,
  BP_GangHasArmyTier_C,
  BP_ChangePlayersArmyTier_C,
  BP_ChangePlayerCash_C,
  BP_AddJobParameterByOutParameter_C,
  BP_AddJobParameterByVariable_C,
  BP_IsThereAvailableJob_C,
  BP_ForceLoan_C,
  BP_CheckLoan_C,
  BP_RemoveJob_C,
  BP_ChangeCashForPartner_C,
  BP_ChangeCashForGang_C,
  BP_PlayerNeedsToWaitDays_C,
  BP_PlayerNeedsToHaveCash_C,
  BP_PlayerNeedsToHaveMoneyForAsset_C,
  BP_AllTaskCompleted_C,
  BP_AddGangToAttitudeList_C,
  BP_IsThereGangInAttitudeList_C,
  BP_IsThereParameterInJobWithValue_C,
  BP_UnlockPlotlineAsset_C,
  BP_PlayerOwnsPlotlineAsset_C,
  BP_PlayerHasCash_C,
  BP_GraphConditionByVariable_C,
  BP_WasMissionCompletedInStealth_C,
  BP_RemoveGoalFromPool_C,
  BP_AddUniqHeisterToMarketPool_C,
  BP_AddUniqHeisterToCrew_C,
  BP_PlayerHasSpecificHeister_C,
  BP_CheckJobResult_C,
  BP_ReturnCurrentGoalBackToPool_C,
  BP_AddGraph_C,
  BP_RemoveGraphFromPool_C,
  BP_ToggleBuyingWeapons_C,
  BP_ToggleTurfwarMissionType_C,
  BP_ToggleMarketHireArmyEvent_C,
  BP_ToggleMarketLootEvents_C,
  BP_ToggleMarketWeaponEvent_C,
  BP_ToggleRandEventsSystem_C,
  BP_TogglePlotlineSystem_C,
  BP_ToggleStormPoliceUnits_C,
  BP_UnlockFeature_C,
  BP_RefreshMoneymakingMissions_C,
  BP_ShowStoryNotification_C,
  BP_CurrentDay_C,
  BP_CheckInvestigationState_C,
  BP_SetPersistentTag_C,
  BP_ChangePersistentTag_C,
  BP_ForceTrainingLootEvent_C,
  BP_UnlockAchievement_C,
  BP_CheckGenericHeistersFuneralCooldown_C,
  BP_GangHasTilesCount_C,
  BP_CheckHeatState_C,
  BP_ChangeInvestigationValue_C,
  BP_IsPlayerInBankruptState_C,
  BP_PlayerHasEmptyStash_C,
  BP_PlayerHasLoot_C,
  BP_ChangeHeisterLevel_C,
  BP_RemoveHeisterFromCampaign_C,
  BP_PromoteHeister_C,
  BP_UnlockInMultiplayer_C,
  BP_MovieCondition_C,
  BP_SetCrewRandEventAsReady_C,
  BP_CheckHeistersAmountOnEvent_C,
  BP_AddHeisterToEvent_C,
  BP_HeisterHasTraits_C,
  BP_HeisterUnique_C,
  BP_CheckRandomEvent_C,
  BP_HeisterCompletedAmountOfMissions_C,
  BP_ElapsedTimeAfterHeisterStateChange_C,
  BP_RemoveHeistersFromEvent_C,
  BP_PercentageOfHeistersWithCharacteristics_C,
  BP_ChangeHeisterAttributeByDuration_C,
  BP_HeisterParticipatesInEvent_C,
  BP_FireHeister_C,
  BP_PlayerNeedsToHaveLootAmount_C,
  BP_LootEventCallback_C,
  BP_ChangePlayersArmyAmount_C,
  BP_ChangeLootByVariable_C,
  BP_ChangeLootByValue_C,
  BP_HeisterLeavesCrew_C,
  BP_AreInCrewHeistersWithState_C,
  BP_GangEliminatedCallback_C,
  BP_RemovePlotlineAsset_C,
  BP_AddPlotlineAsset_C,
  BP_ChangeGraphVariableByValue_C,
  BP_CurrentCrewCount_C,
  BP_SetGangArmyTier_C,
  BP_IsHeisterRemovedFromCampaign_C,
  BP_TurfChangeCallback_C,
  BP_AddWeaponsToSpecificCharacterInCrew_C,
  BP_ResetTurfCallback_C,
  BP_HeisterDidAmountOfMission_C,
  BP_KillDetective_C,
  BP_GangHasCash_C,
  BP_DoesHeisterHaveStateFromList_C,
  BP_WasHeisterAssignedToCompletedJob_C,
  BP_ForceJobWithOwnedCrew_C,
  BP_EndCampaign_C,
  BP_ChangeHeatState_C,
  BP_TagIsDivisible_C,
  BP_CheckConditionForHQStorm_C,
  BP_ResultByTagChance_C,
  BP_SwitchToScreen_C,
  BP_PlayerHasMoneyForAsset_C,
  BP_ChangeGraphVariableByVariable_C,
  BP_ChangeTilesOwner_C,
  BP_RemoveGangFromAttitudeList_C,
  BP_PlayMetaDialogue_C,
  BP_MissionWasFinishedWithAmbushResult_C,
  BP_ForceRandomEvent_C,
  BP_ToggleGangsMovementOnMap_C,
  BP_ToggleUniqueCharactersRandomPool_C,
  BP_ToggleHeisterPoolRefresh_C,
  BP_RefreshCityMap_C,
  BP_ForceJobWithUnique_C,
  BP_ChangeTaskProcessValueBy_C,
  BP_RemoveRandomAsset_C,
  BP_PlayerNeedsToHaveTurfsAmount_C,
  BP_PlayerNeedsToHaveArmyAmount_C,
}

const GRAPH = deref(DATA.findIndex(i => i.Type === 'META_StoryGraph'))

GRAPH.populate(main)
