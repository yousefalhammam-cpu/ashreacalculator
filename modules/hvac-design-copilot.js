(function(root, document){
  'use strict';

  var PANEL_ID = 'hvac-design-copilot-panel';
  var TIMELINE_KEY = 'aircalc_hvac_design_copilot_timeline_v1';
  var ACTION_STATE_KEY = 'aircalc_hvac_design_copilot_actions_v1';
  var lastSignature = '';
  var lastScenarios = [];
  var lastSnapshot = null;
  var previousSnapshot = null;
  var aiSummary = null;
  var aiSummaryPending = false;
  var refreshTimer = null;
  var activeTab = 'overview';
  var COPILOT_TABS = [
    { id: 'overview', label: 'Overview', arLabel: 'نظرة عامة' },
    { id: 'review', label: 'Review', arLabel: 'المراجعة' },
    { id: 'reports', label: 'Reports', arLabel: 'التقارير' },
    { id: 'history', label: 'History', arLabel: 'السجل' }
  ];
  var AR_TEXT = {
    'Engineering Design Copilot': 'مساعد التصميم الهندسي',
    'Rules Engine and Equipment Database only': 'يعتمد على محرك القواعد وقاعدة المعدات فقط',
    'Project Health': 'صحة المشروع',
    'Engineering Confidence': 'ثقة القرار',
    'Load': 'الحمل',
    'Selected Capacity': 'السعة المختارة',
    'Ready': 'جاهز',
    'Needs Review': 'يحتاج مراجعة',
    'Blocked': 'متوقف',
    'Project Health Dashboard': 'لوحة الصحة الهندسية',
    'All health indicators are scores out of 100.': 'كل مؤشرات الصحة هي درجات من 100.',
    'Excellent': 'ممتاز',
    'Good': 'جيد',
    'Bad': 'سيء',
    'Live Recommendations': 'التوصيات الحية',
    'No visible recommendations. Re-run review to show all.': 'لا توجد توصيات ظاهرة حاليا. أعد تشغيل المراجعة لإظهار الكل.',
    'Critical': 'حرجة',
    'Warnings': 'تحذيرات',
    'Suggestions': 'اقتراحات',
    'Missing Data': 'بيانات ناقصة',
    'Resolved Locally': 'تم حلها محليا',
    'Re-run Review': 'إعادة تشغيل المراجعة',
    'Auto Optimization': 'التحسين التلقائي',
    'Optimize Project': 'تحسين المشروع',
    'Action Center': 'مركز الإجراءات',
    'No automatic project changes. Scenarios are review-only.': 'لا يتم تطبيق أي تغيير تلقائيا. السيناريوهات للمراجعة فقط.',
    'Why was this selected?': 'لماذا تم اختيار هذا القرار؟',
    'AI does not produce engineering numbers.': 'الذكاء الاصطناعي لا ينتج الأرقام الهندسية.',
    'Engineering Timeline': 'السجل الهندسي',
    'Smart Comparison': 'المقارنة الذكية',
    'HVAC Engineering Review Report': 'تقرير مراجعة HVAC الهندسي',
    'Save Snapshot': 'حفظ لقطة',
    'AI Summary': 'ملخص AI',
    'Print/PDF': 'طباعة / PDF',
    'Export Report': 'تصدير التقرير',
    'The report summarizes health, recommendations, and scenarios from deterministic engines only.': 'التقرير يلخص الصحة والتوصيات والسيناريوهات من المحركات الحتمية فقط.',
    'Saved snapshots': 'لقطات محفوظة',
    'Engineering Data Guardrails': 'حماية البيانات الهندسية',
    'Current Copilot Scope': 'نطاق Copilot الحالي',
    'This phase supports review, explanation, and documentation. It is not a final engineering sign-off without HVAC engineer review.': 'هذه المرحلة تدعم المراجعة والتفسير والتوثيق، وليست اعتمادا هندسيا نهائيا بدون مراجعة مهندس HVAC.',
    'Delivery Decision Summary': 'ملخص قرار التسليم',
    'Project appears ready under current Copilot rules, with engineer review still required.': 'المشروع يبدو جاهزا حسب قواعد Copilot الحالية، مع بقاء مراجعة المهندس مطلوبة.',
    'Delivery is blocked or delayed. Review the risk register and handoff checklist before issuing the report.': 'يوجد ما يمنع أو يؤخر التسليم. راجع سجل المخاطر وقائمة التسليم قبل إصدار التقرير.',
    'Design changes will appear here when load, capacity, or airflow changes.': 'سيظهر هنا سجل تغييرات التصميم عند تعديل الحمل أو السعة أو تدفق الهواء.',
    'Review snapshots imported for current project': 'تم استيراد لقطات مراجعة للمشروع الحالي',
    'Snapshot import failed': 'فشل استيراد ملف اللقطات',
    'Review item dismissed': 'تم إخفاء ملاحظة مراجعة',
    'Review item marked resolved locally': 'تم تعليم ملاحظة كمحلولة محليا',
    'Copilot review re-run': 'تمت إعادة تشغيل مراجعة Copilot',
    'Project review snapshots exported': 'تم تصدير لقطات مراجعة المشروع',
    'Current project review snapshots cleared': 'تم مسح لقطات مراجعة المشروع الحالي',
    'Optimization scenarios generated for review': 'تم إنشاء سيناريوهات تحسين للمراجعة',
    'HVAC review report exported': 'تم تصدير تقرير مراجعة HVAC',
    'Engineering review snapshot saved': 'تم حفظ لقطة مراجعة هندسية',
    'Printable review report opened': 'تم فتح تقرير مراجعة قابل للطباعة',
    'Printable HTML report downloaded': 'تم تنزيل تقرير HTML للطباعة',
    'AI adapter is not connected. Rules Engine results continue.': 'طبقة AI غير متصلة. نتائج محرك القواعد مستمرة.',
    'Review live recommendations.': 'راجع التوصيات الحية.',
    'Fallback summary used after AI failure': 'تم استخدام ملخص احتياطي عند فشل AI',
    'Explain-only AI summary generated': 'تم إنشاء ملخص AI تفسيري',
    'AI summary failed. Rules Engine results continue.': 'فشل ملخص AI. نتائج محرك القواعد مستمرة.',
    'Increase selected capacity': 'زيادة السعة المختارة',
    'Selected equipment capacity is below the required cooling load.': 'سعة الوحدة المختارة أقل من الحمل الحراري المطلوب.',
    'Reduces undersizing risk before approval.': 'يقلل خطر اختيار سعة أقل من المطلوب قبل الاعتماد.',
    'Review supply airflow': 'مراجعة تدفق هواء الإمداد',
    'Selected equipment airflow is below the project required CFM.': 'تدفق هواء الوحدة المختارة أقل من CFM المطلوب للمشروع.',
    'Improves air distribution and ventilation confidence.': 'يحسن توزيع الهواء وثقة التهوية.',
    'Verify catalogue data': 'تحقق من بيانات الكتالوج',
    'One or more selected units are missing verified catalogue snapshots.': 'وحدة أو أكثر لا تحتوي على لقطة كتالوج موثقة.',
    'Improves submittal traceability and reduces model selection errors.': 'يحسن تتبع الاعتماد ويقلل أخطاء اختيار الموديل.',
    'Select project equipment': 'اختر وحدة للمشروع',
    'The project has calculated load but no selected equipment capacity.': 'يوجد حمل محسوب للمشروع لكن لا توجد سعة وحدة مختارة.',
    'Enables capacity validation and reporting readiness.': 'يمكّن فحص السعة وجاهزية التقرير.',
    'Review oversizing': 'مراجعة زيادة السعة',
    'Selected capacity is significantly above the required cooling load.': 'السعة المختارة أعلى بكثير من الحمل الحراري المطلوب.',
    'Improves comfort, cycling behavior, and energy performance.': 'يحسن الراحة وسلوك التشغيل وكفاءة الطاقة.',
    'Complete room inputs': 'إكمال مدخلات الغرف',
    'Some room records are missing required load or airflow fields.': 'بعض الغرف ينقصها الحمل أو تدفق الهواء المطلوب.',
    'Improves data quality and review confidence.': 'يحسن جودة البيانات وثقة المراجعة.',
    'Check duct ESP': 'فحص ضغط الدكت ESP',
    'Static pressure appears incomplete or outside a comfortable validation band.': 'بيانات الضغط الساكن غير مكتملة أو خارج نطاق تحقق مناسب.',
    'Reduces fan selection and noise risk.': 'يقلل مخاطر اختيار المروحة والضوضاء.',
    'Keep current engineering path': 'استمر على المسار الهندسي الحالي',
    'The deterministic checks do not show a blocking design risk.': 'الفحوصات الحتمية لا تظهر خطرا يمنع التصميم.',
    'Maintain review discipline before final approval.': 'استمر بالمراجعة المنظمة قبل الاعتماد النهائي.',
    'Cooling load calculated': 'تم حساب الحمل الحراري',
    'Equipment capacity selected': 'تم اختيار سعة الوحدة',
    'Equipment snapshot available': 'لقطة كتالوج الوحدة متوفرة',
    'Supply airflow checked': 'تم فحص تدفق هواء الإمداد',
    'No critical review findings': 'لا توجد ملاحظات حرجة',
    'Required data complete': 'البيانات المطلوبة مكتملة',
    'Engineering confidence acceptable': 'ثقة القرار الهندسي مقبولة',
    'Delivery readiness gate': 'بوابة جاهزية التسليم',
    'AI is explain-only': 'AI للتفسير فقط',
    'Missing project load': 'حمل المشروع غير موجود',
    'No selected capacity': 'لا توجد سعة مختارة',
    'At least one project unit has a catalogue snapshot': 'توجد لقطة كتالوج لوحدة واحدة على الأقل',
    'No catalogue snapshot attached': 'لا توجد لقطة كتالوج مرفقة',
    'Critical findings remain': 'ما زالت توجد ملاحظات حرجة',
    'No critical findings': 'لا توجد ملاحظات حرجة',
    'missing inputs': 'مدخلات ناقصة',
    'AI does not calculate or select equipment': 'AI لا يحسب ولا يختار المعدات',
    'Delivery readiness is blocked': 'جاهزية التسليم متوقفة',
    'Project should not be issued to client before blocking review items are closed.': 'لا ينبغي إصدار المشروع للعميل قبل إغلاق الملاحظات المانعة.',
    'Resolve critical findings, missing inputs, or low health score, then re-run review.': 'عالج الملاحظات الحرجة أو المدخلات الناقصة أو انخفاض الصحة ثم أعد تشغيل المراجعة.',
    'Monitor project assumptions': 'راقب افتراضات المشروع',
    'Engineering review impact': 'أثر على المراجعة الهندسية',
    'Review with HVAC engineer before approval.': 'راجعه مع مهندس HVAC قبل الاعتماد.',
    'Current': 'الحالي',
    'Optimized': 'المحسن',
    'Previous': 'السابق',
    'Balanced capacity': 'سعة متوازنة',
    'Airflow risk reduction': 'تقليل مخاطر تدفق الهواء',
    'Lower oversizing': 'تقليل زيادة السعة',
    'From current equipment database': 'من قاعدة المعدات الحالية',
    'Use current ESP calculation': 'استخدم حساب ESP الحالي'
  };

  function isArabic(){
    return root.lang === 'ar' || document.documentElement.dir === 'rtl';
  }

  function text(ar, en){
    if(isArabic()) return AR_TEXT[en] || en || ar;
    return en;
  }

  function uiText(value){
    value = String(value == null ? '' : value);
    return isArabic() ? (AR_TEXT[value] || value) : value;
  }

  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmt(value, digits){
    var n = Number(value);
    if(!Number.isFinite(n)) n = 0;
    return n.toLocaleString('en-US', {
      maximumFractionDigits: digits == null ? 0 : digits
    });
  }

  function getPanel(){
    return document.getElementById(PANEL_ID);
  }

  function readTimeline(){
    try{
      var parsed = JSON.parse(root.localStorage.getItem(TIMELINE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    }catch(error){
      return [];
    }
  }

  function writeTimeline(items){
    try{
      root.localStorage.setItem(TIMELINE_KEY, JSON.stringify(items.slice(0, 40)));
    }catch(error){}
  }

  function readActionState(){
    try{
      var parsed = JSON.parse(root.localStorage.getItem(ACTION_STATE_KEY) || '{}');
      return {
        dismissed: parsed && parsed.dismissed ? parsed.dismissed : {},
        resolved: parsed && parsed.resolved ? parsed.resolved : {}
      };
    }catch(error){
      return { dismissed: {}, resolved: {} };
    }
  }

  function writeActionState(state){
    try{
      root.localStorage.setItem(ACTION_STATE_KEY, JSON.stringify(state || { dismissed: {}, resolved: {} }));
    }catch(error){}
  }

  function actionId(item){
    return String((item && item.priority) || 'item') + ':' + String((item && item.title) || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  function visibleRecommendations(recommendations, actionState){
    actionState = actionState || readActionState();
    return (recommendations || []).filter(function(item){
      return !actionState.dismissed[actionId(item)];
    });
  }

  function signature(snapshot){
    var totals = snapshot.totals || {};
    var systems = snapshot.systems || {};
    return [
      Math.round(totals.requiredBtu || 0),
      Math.round(totals.selectedBtu || 0),
      Math.round(totals.requiredCfm || 0),
      Math.round(totals.selectedCfm || 0),
      systems.count || 0,
      snapshot.rooms && snapshot.rooms.count || 0
    ].join('|');
  }

  function addTimelineEvent(kind, message, snapshot){
    var items = readTimeline();
    items.unshift({
      id: Date.now(),
      at: new Date().toISOString(),
      kind: kind,
      message: message,
      requiredBtu: snapshot && snapshot.totals ? Math.round(snapshot.totals.requiredBtu || 0) : 0,
      selectedBtu: snapshot && snapshot.totals ? Math.round(snapshot.totals.selectedBtu || 0) : 0
    });
    writeTimeline(items);
  }

  function captureStateChange(snapshot){
    var next = signature(snapshot);
    if(!lastSignature){
      lastSignature = next;
      lastSnapshot = snapshot;
      return;
    }
    if(next !== lastSignature){
      previousSnapshot = lastSnapshot;
      lastSignature = next;
      lastSnapshot = snapshot;
      addTimelineEvent('change', text('ØªÙ… ØªØ­Ø¯ÙŠØ« Ø­Ø§Ù„Ø© Ø§Ù„ØªØµÙ…ÙŠÙ…', 'Design state updated'), snapshot);
    }else{
      lastSnapshot = snapshot;
    }
  }

  function metricLabel(key){
    var indicativeLabels = {
      energy: ['مؤشر فرق السعة، وليس كفاءة الطاقة','Capacity-based indicator, not energy efficiency'],
      esp: ['مؤشر الضغط المحسوب، وليس مطابقة المروحة','Calculated pressure indicator, not fan compliance'],
      electrical: ['اكتمال بيانات الكهرباء','Electrical data completeness'],
      maintainability: ['مؤشر تعقيد الوحدات','Unit complexity indicator']
    };
    if(indicativeLabels[key]) return text(indicativeLabels[key][0], indicativeLabels[key][1]);
    var labels = {
      capacity: text('Ø§Ù„Ø³Ø¹Ø©', 'Capacity'),
      airflow: text('ØªØ¯ÙÙ‚ Ø§Ù„Ù‡ÙˆØ§Ø¡', 'Airflow'),
      esp: 'ESP',
      energy: text('Ø§Ù„Ø·Ø§Ù‚Ø©', 'Energy'),
      electrical: text('Ø§Ù„ÙƒÙ‡Ø±Ø¨Ø§Ø¡', 'Electrical'),
      maintainability: text('Ø§Ù„ØµÙŠØ§Ù†Ø©', 'Maintainability'),
      dataQuality: text('Ø¬ÙˆØ¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª', 'Data Quality'),
      equipmentVerification: text('ØªÙˆØ«ÙŠÙ‚ Ø§Ù„Ù…Ø¹Ø¯Ø§Øª', 'Equipment Verification')
    };
    return labels[key] || key;
  }

  function renderMetric(metric){
    var names={capacity:['توافق السعة','Capacity match'],airflow:['تدفق الهواء','Airflow'],esp:['مراجعة الضغط','Pressure review'],energy:['مؤشر السعة — ليس كفاءة الطاقة','Capacity indicator — not energy efficiency'],electrical:['بيانات الكهرباء','Electrical data'],maintainability:['تعقيد الوحدات','Unit complexity'],dataQuality:['اكتمال البيانات','Data completeness'],equipmentVerification:['توثيق المعدات','Equipment verification']};
    var label=names[metric.key]?text(names[metric.key][0],names[metric.key][1]):metricLabel(metric.key);
    if(metric.estimated)label+=' — '+text('تقديري بعد الفلتر','estimated after filter');
    if(metric.pending)label+=' — '+text('بيانات المروحة غير مكتملة','fan data required');
    return '<button type="button" class="copilot-metric copilot-metric-action copilot-tone-' + esc(metric.tone) + '" onclick="openHealthMetricEditor(\''+esc(metric.key)+'\')" aria-label="'+esc(label+' — '+text('مراجعة وتعديل','Review and edit'))+'">' +
      '<span>' + esc(label) + '<small class="metric-action-label">'+esc(text('مراجعة وتعديل ←','Review and edit →'))+'</small></span>' +
      '<strong>' + (metric.pending?'—':fmt(metric.score)) + '<small>/100</small></strong>' +
      (metric.actual && !metric.pending?'<small dir="ltr">'+esc(metric.actual)+'</small>':'')+
    '</button>';
  }

  function renderHealthLegend(){
    return '<div class="copilot-health-legend" aria-label="Health color legend">' +
      '<span><i class="legend-dot green"></i>' + esc(text('Ù…Ù…ØªØ§Ø²', 'Excellent')) + '</span>' +
      '<span><i class="legend-dot blue"></i>' + esc(text('Ø¬ÙŠØ¯', 'Good')) + '</span>' +
      '<span><i class="legend-dot red"></i>' + esc(text('Ø³ÙŠØ¡', 'Bad')) + '</span>' +
    '</div>';
  }

  function priorityLabel(priority){
    if(priority === 'critical') return text('Ø­Ø±Ø¬', 'Critical');
    if(priority === 'warning') return text('ØªØ­Ø°ÙŠØ±', 'Warning');
    return text('Ø§Ù‚ØªØ±Ø§Ø­', 'Suggestion');
  }

  function renderRecommendation(item, actionState){
    var id = actionId(item);
    var resolved = actionState && actionState.resolved && actionState.resolved[id];
    return '<div class="copilot-rec copilot-priority-' + esc(item.priority) + (resolved ? ' is-resolved' : '') + '">' +
      '<div class="copilot-rec-head"><span>' + esc(priorityLabel(item.priority)) + '</span><strong>' + esc(uiText(item.title)) + '</strong></div>' +
      '<p>' + esc(uiText(item.reason)) + '</p>' +
      '<small>' + esc(uiText(item.expectedBenefit)) + '</small>' +
      '<div class="copilot-rec-actions">' +
        '<button type="button" data-copilot-action="resolve" data-copilot-action-id="' + esc(id) + '">' + esc(resolved ? text('ØªÙ… Ø§Ù„Ø­Ù„', 'Resolved') : text('Ø­Ù„ Ù…Ø­Ù„ÙŠ', 'Resolve')) + '</button>' +
        '<button type="button" data-copilot-action="dismiss" data-copilot-action-id="' + esc(id) + '">' + esc(text('Ø¥Ø®ÙØ§Ø¡', 'Dismiss')) + '</button>' +
      '</div>' +
    '</div>';
  }

  function renderScenarioRows(scenarios){
    if(!scenarios.length){
      return '<div class="copilot-empty">' + esc(text('Ù„Ø§ ØªÙˆØ¬Ø¯ Ø³ÙŠÙ†Ø§Ø±ÙŠÙˆÙ‡Ø§Øª Ù‚Ø¨Ù„ ØªÙˆÙØ± Ø­Ù…Ù„ Ù…Ø´Ø±ÙˆØ¹ ÙˆØ§Ø¶Ø­.', 'No scenarios until a clear project load exists.')) + '</div>';
    }
    return '<div class="copilot-table-wrap"><table class="copilot-table">' +
      '<thead><tr>' +
        '<th>' + esc(text('Ø§Ù„Ø³ÙŠÙ†Ø§Ø±ÙŠÙˆ', 'Scenario')) + '</th>' +
        '<th>' + esc(text('Ø§Ù„ÙˆØµÙ', 'Description')) + '</th>' +
        '<th>BTU/h</th><th>CFM</th><th>' + esc(text('ÙØ±Ù‚ Ø§Ù„Ø³Ø¹Ø©', 'Oversizing')) + '</th><th>' + esc(text('Ø§Ù„ÙˆØ­Ø¯Ø§Øª', 'Units')) + '</th><th>' + esc(text('Ø§Ù„Ø¯Ø±Ø¬Ø©', 'Score')) + '</th>' +
      '</tr></thead><tbody>' +
      scenarios.map(function(scenario){
        return '<tr>' +
          '<td><strong>' + esc(scenario.label) + '</strong></td>' +
          '<td>' + esc(uiText(scenario.description)) + '</td>' +
          '<td>' + fmt(scenario.capacityBtu) + '</td>' +
          '<td>' + fmt(scenario.cfm) + '</td>' +
          '<td>' + fmt(scenario.oversizingPct, 1) + '%</td>' +
          '<td>' + fmt(scenario.numberOfUnits) + '</td>' +
          '<td><span class="copilot-score-pill">' + fmt(scenario.engineeringScore) + '</span></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function renderComparison(comparison){
    var rows = comparison && comparison.rows ? comparison.rows : [];
    return '<div class="copilot-table-wrap"><table class="copilot-table copilot-compare-table">' +
      '<thead><tr><th>' + esc(text('Ø§Ù„Ø­Ø§Ù„Ø©', 'State')) + '</th><th>BTU/h</th><th>CFM</th><th>' + esc(text('ÙØ±Ù‚ Ø§Ù„Ø³Ø¹Ø©', 'Oversizing')) + '</th><th>' + esc(text('Ø§Ù„Ø¯Ø±Ø¬Ø©', 'Score')) + '</th></tr></thead>' +
      '<tbody>' + rows.map(function(row){
        return '<tr>' +
          '<td><strong>' + esc(uiText(row.name)) + '</strong></td>' +
          '<td>' + fmt(row.capacityBtu) + '</td>' +
          '<td>' + fmt(row.cfm) + '</td>' +
          '<td>' + fmt(row.oversizingPct, 1) + '%</td>' +
          '<td><span class="copilot-score-pill">' + fmt(row.engineeringScore) + '</span></td>' +
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderDecisionExplanation(explanation){
    var basis = explanation && explanation.basis ? explanation.basis : [];
    var findings = explanation && explanation.reviewFindings ? explanation.reviewFindings : [];
    return '<p class="copilot-note">' + esc(uiText(explanation.summary || '')) + '</p>' +
      '<div class="copilot-evidence-list">' + basis.map(function(item){
        return '<span>' + esc(uiText(item)) + '</span>';
      }).join('') + '</div>' +
      '<div class="copilot-finding-list">' + findings.slice(0, 4).map(function(item){
        return '<div>' + esc(uiText(item)) + '</div>';
      }).join('') + '</div>';
  }

  function renderTimeline(){
    var items = readTimeline().slice(0, 5);
    if(!items.length){
      return '<div class="copilot-empty">' + esc(text('Ø³ÙŠØ¸Ù‡Ø± Ù‡Ù†Ø§ Ø³Ø¬Ù„ ØªØºÙŠÙŠØ±Ø§Øª Ø§Ù„ØªØµÙ…ÙŠÙ… Ø¹Ù†Ø¯ ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ø­Ù…Ù„ Ø£Ùˆ Ø§Ù„Ø³Ø¹Ø© Ø£Ùˆ Ø§Ù„ØªØ¯ÙÙ‚.', 'Design changes will appear here when load, capacity, or airflow changes.')) + '</div>';
    }
    return '<div class="copilot-timeline">' + items.map(function(item){
      var date = new Date(item.at);
      return '<div class="copilot-timeline-item">' +
        '<span>' + esc(date.toLocaleTimeString(isArabic() ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })) + '</span>' +
        '<strong>' + esc(item.message) + '</strong>' +
        '<small>' + esc('BTU ' + fmt(item.requiredBtu) + ' / ' + fmt(item.selectedBtu)) + '</small>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderActionCenter(actionCenter, actionState){
    var resolvedCount = Object.keys((actionState && actionState.resolved) || {}).length;
    return '<div class="copilot-action-grid">' +
      '<div><span>' + esc(text('Ø­Ø±Ø¬Ø©', 'Critical')) + '</span><strong>' + fmt(actionCenter.critical.length) + '</strong></div>' +
      '<div><span>' + esc(text('ØªØ­Ø°ÙŠØ±Ø§Øª', 'Warnings')) + '</span><strong>' + fmt(actionCenter.warnings.length) + '</strong></div>' +
      '<div><span>' + esc(text('Ø§Ù‚ØªØ±Ø§Ø­Ø§Øª', 'Suggestions')) + '</span><strong>' + fmt(actionCenter.suggestions.length) + '</strong></div>' +
      '<div><span>' + esc(text('Ø¨ÙŠØ§Ù†Ø§Øª Ù†Ø§Ù‚ØµØ©', 'Missing Data')) + '</span><strong>' + fmt(actionCenter.missingData) + '</strong></div>' +
      '<div><span>' + esc(text('ØªÙ… Ø­Ù„Ù‡Ø§ Ù…Ø­Ù„ÙŠØ§', 'Resolved Locally')) + '</span><strong>' + fmt(resolvedCount) + '</strong></div>' +
    '</div><button type="button" class="copilot-rerun-btn" id="copilot-rerun-btn">' + esc(text('Ø¥Ø¹Ø§Ø¯Ø© ØªØ´ØºÙŠÙ„ Ø§Ù„Ù…Ø±Ø§Ø¬Ø¹Ø©', 'Re-run Review')) + '</button>';
  }

  function downloadReviewReport(report, readiness){
    var lines = [
      '# ' + report.title,
      '',
      'Generated: ' + report.generatedAt,
      'Source of truth: ' + report.sourceOfTruth,
      'AI generated engineering numbers: ' + String(report.aiGeneratedNumbers),
      '',
      '## Executive Status',
      '- Project Health: ' + report.projectHealth + '/100',
      '- Engineering Confidence: ' + report.confidence + '/100',
      '- Required Load: ' + Math.round(report.totals.requiredBtu || 0) + ' BTU/h',
      '- Selected Capacity: ' + Math.round(report.totals.selectedBtu || 0) + ' BTU/h',
      '- Required Airflow: ' + Math.round(report.totals.requiredCfm || 0) + ' CFM',
      '- Selected Airflow: ' + Math.round(report.totals.selectedCfm || 0) + ' CFM',
      ''
    ];
    if(readiness){
      lines.push(
        '## Delivery Readiness',
        '- Status: ' + readiness.status,
        '- Ready for client: ' + String(readiness.readyForClient),
        '- Critical blockers: ' + String(readiness.criticalCount || 0),
        '- Missing inputs: ' + String(readiness.missingInputs || 0)
      );
      if(!readiness.readyForClient){
        lines.push('- WARNING: Report exported while delivery readiness is not ready.');
      }
      lines.push('');
    }
    lines.push(
      '## Health Metrics'
    );
    report.metrics.forEach(function(metric){
      lines.push('- ' + metric.key + ': ' + metric.score + '/100 (' + metric.tone + ')');
    });
    lines.push('', '## Recommendations');
    report.recommendations.forEach(function(item){
      lines.push('- [' + item.priority + '] ' + item.title + ' - ' + item.reason);
    });
    lines.push('', '## Optimization Scenarios');
    report.scenarios.forEach(function(item){
      lines.push('- Scenario ' + item.label + ': ' + item.description + ', ' + item.capacityBtu + ' BTU/h, ' + item.cfm + ' CFM, score ' + item.engineeringScore);
    });
    lines.push('', '## Decision Explanation');
    report.decisionExplanation.basis.forEach(function(item){ lines.push('- ' + item); });
    lines.push('', 'Note: this report is generated from deterministic engines only. AI may summarize text in future phases but must not calculate or select equipment.');

    var blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'HVAC_ENGINEERING_REVIEW_REPORT.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    root.setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  }

  function renderAiSummary(){
    if(aiSummaryPending){
      return '<div class="copilot-ai-summary is-pending">' + esc(text('Ø¬Ø§Ø±ÙŠ ØªØ¬Ù‡ÙŠØ² Ù…Ù„Ø®Øµ Ù†ØµÙŠ Ø¢Ù…Ù†...', 'Preparing safe narrative summary...')) + '</div>';
    }
    if(!aiSummary){
      return '<div class="copilot-ai-summary">' + esc(text('Ø§Ø®ØªÙŠØ§Ø±ÙŠ: Ø£Ù†Ø´Ø¦ Ù…Ù„Ø®ØµØ§ Ù†ØµÙŠØ§ ÙÙ‚Ø·. Ø§Ù„Ø£Ø±Ù‚Ø§Ù… ØªØ¨Ù‚Ù‰ Ù…Ù† Rules Engine.', 'Optional: generate text summary only. Numbers remain from Rules Engine.')) + '</div>';
    }
    return '<div class="copilot-ai-summary' + (aiSummary.fallback ? ' is-fallback' : '') + '">' +
      '<strong>' + esc(aiSummary.fallback ? text('Ù…Ù„Ø®Øµ Ø­ØªÙ…ÙŠ Ø§Ø­ØªÙŠØ§Ø·ÙŠ', 'Deterministic fallback summary') : text('Ù…Ù„Ø®Øµ AI ØªÙØ³ÙŠØ±ÙŠ', 'Explain-only AI summary')) + '</strong>' +
      '<p>' + esc(aiSummary.summary || '') + '</p>' +
      '<small>' + esc(aiSummary.nextStep || aiSummary.note || '') + '</small>' +
    '</div>';
  }

  function currentProjectKey(snapshot){
    return snapshot && snapshot.identity && snapshot.identity.projectKey ? snapshot.identity.projectKey : 'default-project';
  }

  function snapshotHistoryCount(snapshot){
    if(!root.AirCalcCopilotReviewStore || typeof root.AirCalcCopilotReviewStore.readAll !== 'function') return 0;
    return root.AirCalcCopilotReviewStore.readAll(currentProjectKey(snapshot)).length;
  }

  function previousSnapshotFromStore(snapshot){
    if(!root.AirCalcCopilotReviewStore || typeof root.AirCalcCopilotReviewStore.latest !== 'function') return null;
    var saved = root.AirCalcCopilotReviewStore.latest(currentProjectKey(snapshot));
    if(!saved) return null;
    return {
      totals: saved.totals || {},
      rooms: { count: 1, missingInputs: 0 },
      systems: { items: [] },
      validation: { items: [] }
    };
  }

  function readinessLabel(status){
    if(status === 'ready') return text('Ø¬Ø§Ù‡Ø² Ù„Ù„ØªØ³Ù„ÙŠÙ…', 'Ready for delivery');
    if(status === 'blocked') return text('ØºÙŠØ± Ø¬Ø§Ù‡Ø²', 'Blocked');
    return text('ÙŠØ­ØªØ§Ø¬ Ù…Ø±Ø§Ø¬Ø¹Ø©', 'Review required');
  }

  function renderReadinessGate(readiness){
    return '<div class="copilot-readiness copilot-readiness-' + esc(readiness.status) + '">' +
      '<div><span>' + esc(text('Ø¬Ø§Ù‡Ø²ÙŠØ© Ø§Ù„ØªØ³Ù„ÙŠÙ…', 'Delivery Readiness')) + '</span><strong>' + esc(readinessLabel(readiness.status)) + '</strong></div>' +
      '<div class="copilot-readiness-grid">' +
        '<span>Health ' + fmt(readiness.health) + '</span>' +
        '<span>Confidence ' + fmt(readiness.confidence) + '</span>' +
        '<span>Critical ' + fmt(readiness.critical) + '</span>' +
        '<span>Missing ' + fmt(readiness.missingInputs) + '</span>' +
      '</div>' +
    '</div>';
  }

  function renderSnapshotHistory(snapshot){
    if(!root.AirCalcCopilotReviewStore || typeof root.AirCalcCopilotReviewStore.readAll !== 'function'){
      return '<div class="copilot-empty">' + esc(text('Ù…Ø®Ø²Ù† Ø§Ù„Ù„Ù‚Ø·Ø§Øª ØºÙŠØ± Ù…ØªØ§Ø­.', 'Snapshot store is unavailable.')) + '</div>';
    }
    var items = root.AirCalcCopilotReviewStore.readAll(currentProjectKey(snapshot)).slice(0, 4);
    var latest = items[0] || null;
    var currentHealth = root.AirCalcCopilotHealthEngine ? root.AirCalcCopilotHealthEngine.calculateHealth(snapshot).overall : 0;
    var currentConfidence = root.AirCalcCopilotHealthEngine ? root.AirCalcCopilotHealthEngine.calculateConfidence(snapshot).score : 0;
    var healthDelta = latest ? currentHealth - Number(latest.projectHealth || 0) : 0;
    var confidenceDelta = latest ? currentConfidence - Number(latest.confidence || 0) : 0;
    var trend = latest ? '<div class="copilot-trend-row">' +
      '<span class="' + (healthDelta >= 0 ? 'up' : 'down') + '">Health ' + (healthDelta >= 0 ? '+' : '') + fmt(healthDelta) + '</span>' +
      '<span class="' + (confidenceDelta >= 0 ? 'up' : 'down') + '">Confidence ' + (confidenceDelta >= 0 ? '+' : '') + fmt(confidenceDelta) + '</span>' +
    '</div>' : '';
    var body = items.length ? '<div class="copilot-snapshot-list">' + items.map(function(item){
      var date = item.generatedAt ? new Date(item.generatedAt) : null;
      return '<div class="copilot-snapshot-item">' +
        '<strong>' + esc((date && !isNaN(date.getTime())) ? date.toLocaleString('en-US') : item.id) + '</strong>' +
        '<span>Health ' + fmt(item.projectHealth) + ' / Confidence ' + fmt(item.confidence) + '</span>' +
      '</div>';
    }).join('') + '</div>' : '<div class="copilot-empty">' + esc(text('Ù„Ø§ ØªÙˆØ¬Ø¯ Ù„Ù‚Ø·Ø§Øª Ù…Ø­ÙÙˆØ¸Ø© Ù„Ù‡Ø°Ø§ Ø§Ù„Ù…Ø´Ø±ÙˆØ¹ Ø¨Ø¹Ø¯.', 'No saved snapshots for this project yet.')) + '</div>';
    return '<div class="copilot-section-head"><h3>' + esc(text('Ø³Ø¬Ù„ Ù„Ù‚Ø·Ø§Øª Ø§Ù„Ù…Ø±Ø§Ø¬Ø¹Ø©', 'Review Snapshot History')) + '</h3><div class="copilot-btn-row"><button type="button" class="copilot-small-btn" id="copilot-import-snapshots-btn">' + esc(text('Ø§Ø³ØªÙŠØ±Ø§Ø¯ JSON', 'Import JSON')) + '</button><button type="button" class="copilot-small-btn" id="copilot-export-snapshots-btn">' + esc(text('ØªØµØ¯ÙŠØ± JSON', 'Export JSON')) + '</button><button type="button" class="copilot-small-btn danger" id="copilot-clear-snapshots-btn">' + esc(text('Ù…Ø³Ø­ Ø§Ù„Ù„Ù‚Ø·Ø§Øª', 'Clear')) + '</button></div></div><input id="copilot-import-snapshots-input" type="file" accept="application/json,.json" style="display:none">' + trend + body;
  }

  function renderHandoffChecklist(checklist){
    checklist = checklist || { items: [], passed: 0, total: 0 };
    return '<div class="copilot-section-head"><h3>' + esc(text('Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„ØªØ³Ù„ÙŠÙ… Ø§Ù„Ù‡Ù†Ø¯Ø³ÙŠØ©', 'Engineering Handoff Checklist')) + '</h3><span class="copilot-check-count">' + fmt(checklist.passed) + '/' + fmt(checklist.total) + '</span></div>' +
      '<div class="copilot-checklist">' + checklist.items.map(function(item){
        return '<div class="copilot-check-item ' + (item.passed ? 'passed' : 'failed') + '">' +
          '<span>' + (item.passed ? 'âœ“' : '!') + '</span>' +
          '<div><strong>' + esc(uiText(item.label)) + '</strong><small>' + esc(uiText(item.detail)) + '</small></div>' +
        '</div>';
      }).join('') + '</div>';
  }

  function renderRiskRegister(riskRegister){
    riskRegister = riskRegister || { items: [], high: 0, medium: 0, low: 0 };
    return '<div class="copilot-section-head"><h3>' + esc(text('Ø³Ø¬Ù„ Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ø§Ù„Ù‡Ù†Ø¯Ø³ÙŠØ©', 'Engineering Risk Register')) + '</h3><span class="copilot-risk-count">H ' + fmt(riskRegister.high) + ' / M ' + fmt(riskRegister.medium) + ' / L ' + fmt(riskRegister.low) + '</span></div>' +
      '<div class="copilot-risk-list">' + riskRegister.items.map(function(item){
        return '<div class="copilot-risk-item severity-' + esc(item.severity) + '">' +
          '<span>' + esc(item.severity.toUpperCase()) + '</span>' +
          '<div><strong>' + esc(uiText(item.title)) + '</strong><small>' + esc(uiText(item.mitigation)) + '</small></div>' +
        '</div>';
      }).join('') + '</div>';
  }

  function openPrintableReport(report, readiness){
    var identity = report.identity || {};
    var rows = (report.metrics || []).map(function(metric){
      return '<tr><td>' + esc(metric.key) + '</td><td>' + esc(metric.score) + '/100</td><td>' + esc(metric.tone) + '</td></tr>';
    }).join('');
    var recs = (report.recommendations || []).map(function(item){
      return '<li><strong>' + esc(item.priority) + ' - ' + esc(item.title) + '</strong><br>' + esc(item.reason) + '</li>';
    }).join('');
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(report.title) + '</title>' +
      '<style>body{font-family:Arial,sans-serif;margin:32px;color:#111827}h1{margin:0 0 6px}h2{margin-top:26px;border-bottom:1px solid #d1d5db;padding-bottom:6px}.meta,.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.box{border:1px solid #d1d5db;border-radius:10px;padding:12px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left}.status{font-weight:bold}.note{color:#6b7280;font-size:12px}@media print{button{display:none}}</style></head><body>' +
      '<button onclick="window.print()">Print / Save PDF</button>' +
      '<h1>' + esc(report.title) + '</h1><div class="note">Source of truth: rules_engine. AI generated engineering numbers: false.</div>' +
      '<h2>Project Identity</h2><div class="meta">' +
        '<div class="box">Project: <strong>' + esc(identity.projectName || '') + '</strong></div>' +
        '<div class="box">Project No: <strong>' + esc(identity.projectNo || '') + '</strong></div>' +
        '<div class="box">Client: <strong>' + esc(identity.clientName || '') + '</strong></div>' +
        '<div class="box">Location: <strong>' + esc(identity.location || '') + '</strong></div>' +
      '</div>' +
      '<h2>Executive Status</h2><div class="grid">' +
        '<div class="box">Project Health: <strong>' + esc(report.projectHealth) + '/100</strong></div>' +
        '<div class="box">Confidence: <strong>' + esc(report.confidence) + '/100</strong></div>' +
        '<div class="box">Delivery Readiness: <strong class="status">' + esc(readinessLabel(readiness.status)) + '</strong></div>' +
        '<div class="box">Required Load: <strong>' + esc(Math.round(report.totals.requiredBtu || 0)) + ' BTU/h</strong></div>' +
      '</div>' +
      '<h2>Health Metrics</h2><table><thead><tr><th>Metric</th><th>Score</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<h2>Recommendations</h2><ul>' + recs + '</ul>' +
      '<h2>Decision Basis</h2><ul>' + ((report.decisionExplanation && report.decisionExplanation.basis) || []).map(function(item){ return '<li>' + esc(item) + '</li>'; }).join('') + '</ul>' +
      '</body></html>';
    var win = root.open('', '_blank');
    if(win && win.document){
      win.document.open();
      win.document.write(html);
      win.document.close();
      return true;
    }
    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'HVAC_ENGINEERING_REVIEW_REPORT.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    root.setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    return false;
  }

  function downloadSnapshotExport(snapshot){
    if(!root.AirCalcCopilotReviewStore || typeof root.AirCalcCopilotReviewStore.exportProject !== 'function') return;
    var payload = root.AirCalcCopilotReviewStore.exportProject(currentProjectKey(snapshot));
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'AIRCALC_COPILOT_REVIEW_SNAPSHOTS_' + currentProjectKey(snapshot) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    root.setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  }

  function importSnapshotFile(file, snapshot){
    if(!file || !root.FileReader || !root.AirCalcCopilotReviewStore || typeof root.AirCalcCopilotReviewStore.importProject !== 'function') return;
    var reader = new FileReader();
    reader.onload = function(){
      try{
        var payload = JSON.parse(String(reader.result || '{}'));
        root.AirCalcCopilotReviewStore.importProject(payload, currentProjectKey(snapshot));
        addTimelineEvent('import-snapshots', text('ØªÙ… Ø§Ø³ØªÙŠØ±Ø§Ø¯ Ù„Ù‚Ø·Ø§Øª Ù…Ø±Ø§Ø¬Ø¹Ø© Ù„Ù„Ù…Ø´Ø±ÙˆØ¹ Ø§Ù„Ø­Ø§Ù„ÙŠ', 'Review snapshots imported for current project'), snapshot);
      }catch(error){
        addTimelineEvent('import-snapshots-failed', text('ÙØ´Ù„ Ø§Ø³ØªÙŠØ±Ø§Ø¯ Ù…Ù„Ù Ø§Ù„Ù„Ù‚Ø·Ø§Øª', 'Snapshot import failed'), snapshot);
      }
      refresh();
    };
    reader.readAsText(file);
  }

  function bindActionButtons(snapshot){
    var panel = getPanel();
    if(!panel) return;
    var buttons = panel.querySelectorAll('[data-copilot-action]');
    buttons.forEach(function(button){
      button.onclick = function(){
        var state = readActionState();
        var id = button.getAttribute('data-copilot-action-id') || '';
        var action = button.getAttribute('data-copilot-action') || '';
        if(action === 'dismiss') state.dismissed[id] = true;
        if(action === 'resolve') state.resolved[id] = true;
        writeActionState(state);
        addTimelineEvent(action, action === 'dismiss' ? text('ØªÙ… Ø¥Ø®ÙØ§Ø¡ Ù…Ù„Ø§Ø­Ø¸Ø© Ù…Ø±Ø§Ø¬Ø¹Ø©', 'Review item dismissed') : text('ØªÙ… ØªØ¹Ù„ÙŠÙ… Ù…Ù„Ø§Ø­Ø¸Ø© ÙƒÙ…Ø­Ù„ÙˆÙ„Ø© Ù…Ø­Ù„ÙŠØ§', 'Review item marked resolved locally'), snapshot);
        refresh();
      };
    });
    var rerun = document.getElementById('copilot-rerun-btn');
    if(rerun){
      rerun.onclick = function(){
        writeActionState({ dismissed: {}, resolved: {} });
        addTimelineEvent('rerun', text('ØªÙ…Øª Ø¥Ø¹Ø§Ø¯Ø© ØªØ´ØºÙŠÙ„ Ù…Ø±Ø§Ø¬Ø¹Ø© Copilot', 'Copilot review re-run'), snapshot);
        refresh();
      };
    }
    var exportSnapshots = document.getElementById('copilot-export-snapshots-btn');
    if(exportSnapshots){
      exportSnapshots.onclick = function(){
        downloadSnapshotExport(snapshot);
        addTimelineEvent('export-snapshots', text('ØªÙ… ØªØµØ¯ÙŠØ± Ù„Ù‚Ø·Ø§Øª Ù…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„Ù…Ø´Ø±ÙˆØ¹', 'Project review snapshots exported'), snapshot);
      };
    }
    var importSnapshots = document.getElementById('copilot-import-snapshots-btn');
    var importInput = document.getElementById('copilot-import-snapshots-input');
    if(importSnapshots && importInput){
      importSnapshots.onclick = function(){ importInput.click(); };
      importInput.onchange = function(){
        importSnapshotFile(importInput.files && importInput.files[0], snapshot);
        importInput.value = '';
      };
    }
    var clearSnapshots = document.getElementById('copilot-clear-snapshots-btn');
    if(clearSnapshots){
      clearSnapshots.onclick = function(){
        if(!root.AirCalcCopilotReviewStore || typeof root.AirCalcCopilotReviewStore.clear !== 'function') return;
        root.AirCalcCopilotReviewStore.clear(currentProjectKey(snapshot));
        addTimelineEvent('clear-snapshots', text('ØªÙ… Ù…Ø³Ø­ Ù„Ù‚Ø·Ø§Øª Ù…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„Ù…Ø´Ø±ÙˆØ¹ Ø§Ù„Ø­Ø§Ù„ÙŠ', 'Current project review snapshots cleared'), snapshot);
        refresh();
      };
    }
  }

  function renderTabs(){
    return '<div class="copilot-tabs" role="tablist" aria-label="HVAC Design Copilot sections">' +
      COPILOT_TABS.map(function(tab){
        var active = tab.id === activeTab;
        return '<button type="button" class="copilot-tab-btn' + (active ? ' active' : '') + '" role="tab" aria-selected="' + String(active) + '" data-copilot-tab="' + esc(tab.id) + '">' + esc(isArabic() ? tab.arLabel : tab.label) + '</button>';
      }).join('') +
    '</div>';
  }

  function bindTabButtons(){
    var panel = getPanel();
    if(!panel) return;
    panel.querySelectorAll('[data-copilot-tab]').forEach(function(button){
      button.onclick = function(){
        activeTab = button.getAttribute('data-copilot-tab') || 'overview';
        refresh();
      };
    });
  }

  function applyActiveTabView(panel){
    var groups = [];
    Array.prototype.forEach.call(panel.children || [], function(child){
      if(child.classList && child.classList.contains('copilot-grid')) groups.push(child);
    });
    var visible = {
      overview: [0, 1],
      review: [2, 5, 6],
      reports: [3],
      history: [4]
    }[activeTab] || [0, 1];
    groups.forEach(function(group, index){
      group.hidden = visible.indexOf(index) === -1;
    });
  }

  function render(snapshot, health, recommendations, visibleRecs, confidence, actionCenter, explanation, comparison, actionState, readiness, checklist, riskRegister){
    var panel = getPanel();
    if(!panel) return;
    panel.style.display = '';
    panel.innerHTML =
      '<div class="copilot-head">' +
        '<div><div class="input-kicker">HVAC Design Copilot</div><div class="input-title">' + esc(text('Ù…Ø³Ø§Ø¹Ø¯ Ø§Ù„ØªØµÙ…ÙŠÙ… Ø§Ù„Ù‡Ù†Ø¯Ø³ÙŠ', 'Engineering Design Copilot')) + '</div></div>' +
        '<div class="copilot-source">' + esc(text('ÙŠØ¹ØªÙ…Ø¯ Ø¹Ù„Ù‰ Rules Engine ÙˆÙ‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ù…Ø¹Ø¯Ø§Øª ÙÙ‚Ø·', 'Rules Engine and Equipment Database only')) + '</div>' +
      '</div>' +
      '<div class="copilot-executive">' +
        '<div class="copilot-overall copilot-tone-' + esc(health.tone) + '"><span>' + esc(text('ØµØ­Ø© Ø§Ù„Ù…Ø´Ø±ÙˆØ¹', 'Project Health')) + '</span><strong>' + fmt(health.overall) + '</strong><small>/100</small></div>' +
        '<div class="copilot-mini"><span>' + esc(text('Ø«Ù‚Ø© Ø§Ù„Ù‚Ø±Ø§Ø±', 'Engineering Confidence')) + '</span><strong>' + fmt(confidence.score) + '<small>/100</small></strong></div>' +
        '<div class="copilot-mini"><span>' + esc(text('Ø§Ù„Ø­Ù…Ù„', 'Load')) + '</span><strong>' + fmt(snapshot.totals.requiredBtu) + ' BTU/h</strong></div>' +
        '<div class="copilot-mini"><span>' + esc(text('Ø§Ù„Ø³Ø¹Ø© Ø§Ù„Ù…Ø®ØªØ§Ø±Ø©', 'Selected Capacity')) + '</span><strong>' + fmt(snapshot.totals.selectedBtu) + ' BTU/h</strong></div>' +
      '</div>' +
      renderReadinessGate(readiness) +
      renderTabs() +
      '<div class="copilot-grid">' +
        '<section><div class="copilot-section-head"><h3>' + esc(text('Ù„ÙˆØ­Ø© Ø§Ù„ØµØ­Ø© Ø§Ù„Ù‡Ù†Ø¯Ø³ÙŠØ©', 'Project Health Dashboard')) + '</h3><span class="copilot-scale-note">' + esc(text('ÙƒÙ„ Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„ØµØ­Ø© Ù‡ÙŠ Ø¯Ø±Ø¬Ø§Øª Ù…Ù† 100.', 'All health indicators are scores out of 100.')) + '</span></div>' + renderHealthLegend() + '<div class="copilot-metrics">' + health.metrics.map(renderMetric).join('') + '</div></section>' +
        '<section><h3>' + esc(text('Ø§Ù„ØªÙˆØµÙŠØ§Øª Ø§Ù„Ø­ÙŠØ©', 'Live Recommendations')) + '</h3><div class="copilot-rec-list">' + (visibleRecs.length ? visibleRecs.map(function(item){ return renderRecommendation(item, actionState); }).join('') : '<div class="copilot-empty">' + esc(text('Ù„Ø§ ØªÙˆØ¬Ø¯ ØªÙˆØµÙŠØ§Øª Ø¸Ø§Ù‡Ø±Ø© Ø­Ø§Ù„ÙŠØ§. Ø£Ø¹Ø¯ ØªØ´ØºÙŠÙ„ Ø§Ù„Ù…Ø±Ø§Ø¬Ø¹Ø© Ù„Ø¥Ø¸Ù‡Ø§Ø± Ø§Ù„ÙƒÙ„.', 'No visible recommendations. Re-run review to show all.')) + '</div>') + '</div></section>' +
      '</div>' +
      '<div class="copilot-grid">' +
        '<section><div class="copilot-section-head"><h3>' + esc(text('Ø§Ù„ØªØ­Ø³ÙŠÙ† Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠ', 'Auto Optimization')) + '</h3><button type="button" class="copilot-btn" id="copilot-optimize-btn">' + esc(text('Optimize Project', 'Optimize Project')) + '</button></div>' + renderScenarioRows(lastScenarios) + '</section>' +
        '<section><h3>' + esc(text('Ù…Ø±ÙƒØ² Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª', 'Action Center')) + '</h3>' + renderActionCenter(actionCenter, actionState) + '<p class="copilot-note">' + esc(text('Ù„Ø§ ÙŠØªÙ… ØªØ·Ø¨ÙŠÙ‚ Ø£ÙŠ ØªØºÙŠÙŠØ± ØªÙ„Ù‚Ø§Ø¦ÙŠØ§. Ø§Ù„Ø³ÙŠÙ†Ø§Ø±ÙŠÙˆÙ‡Ø§Øª Ù„Ù„Ù…Ø±Ø§Ø¬Ø¹Ø© ÙÙ‚Ø·.', 'No automatic project changes. Scenarios are review-only.')) + '</p></section>' +
      '</div>' +
      '<div class="copilot-grid">' +
        '<section><h3>' + esc(text('Ù„Ù…Ø§Ø°Ø§ Ù‡Ø°Ø§ Ø§Ù„Ù‚Ø±Ø§Ø±ØŸ', 'Why was this selected?')) + '</h3>' + renderDecisionExplanation(explanation) + '<p class="copilot-note">' + esc(text('Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ù„Ø§ ÙŠÙ†ØªØ¬ Ø§Ù„Ø£Ø±Ù‚Ø§Ù… Ø§Ù„Ù‡Ù†Ø¯Ø³ÙŠØ©.', 'AI does not produce engineering numbers.')) + '</p></section>' +
        '<section><h3>' + esc(text('Ø§Ù„Ø³Ø¬Ù„ Ø§Ù„Ù‡Ù†Ø¯Ø³ÙŠ', 'Engineering Timeline')) + '</h3>' + renderTimeline() + '</section>' +
      '</div>' +
      '<div class="copilot-grid">' +
        '<section><h3>' + esc(text('Ø§Ù„Ù…Ù‚Ø§Ø±Ù†Ø© Ø§Ù„Ø°ÙƒÙŠØ©', 'Smart Comparison')) + '</h3>' + renderComparison(comparison) + '</section>' +
        '<section><div class="copilot-section-head"><h3>' + esc(text('ØªÙ‚Ø±ÙŠØ± Ù…Ø±Ø§Ø¬Ø¹Ø© HVAC', 'HVAC Engineering Review Report')) + '</h3><div class="copilot-btn-row"><button type="button" class="copilot-btn copilot-save-btn" id="copilot-save-snapshot-btn">' + esc(text('Ø­ÙØ¸ Ù„Ù‚Ø·Ø©', 'Save Snapshot')) + '</button><button type="button" class="copilot-btn copilot-ai-btn" id="copilot-ai-summary-btn">' + esc(text('Ù…Ù„Ø®Øµ AI', 'AI Summary')) + '</button><button type="button" class="copilot-btn copilot-print-btn" id="copilot-print-report-btn">' + esc(text('Print/PDF', 'Print/PDF')) + '</button><button type="button" class="copilot-btn copilot-export-btn" id="copilot-export-btn">' + esc(text('ØªØµØ¯ÙŠØ± Ø§Ù„ØªÙ‚Ø±ÙŠØ±', 'Export Report')) + '</button></div></div><p class="copilot-note">' + esc(text('Ø§Ù„ØªÙ‚Ø±ÙŠØ± ÙŠÙ„Ø®Øµ Ø§Ù„ØµØ­Ø© Ø§Ù„Ù‡Ù†Ø¯Ø³ÙŠØ© ÙˆØ§Ù„ØªÙˆØµÙŠØ§Øª ÙˆØ§Ù„Ø³ÙŠÙ†Ø§Ø±ÙŠÙˆÙ‡Ø§Øª Ù…Ù† Ø§Ù„Ù…Ø­Ø±ÙƒØ§Øª Ø§Ù„Ø­ØªÙ…ÙŠØ© ÙÙ‚Ø·.', 'The report summarizes health, recommendations, and scenarios from deterministic engines only.')) + '</p><div class="copilot-snapshot-count">' + esc(text('Ù„Ù‚Ø·Ø§Øª Ù…Ø­ÙÙˆØ¸Ø©', 'Saved snapshots')) + ': <strong>' + fmt(snapshotHistoryCount(snapshot)) + '</strong></div>' + renderAiSummary() + '</section>' +
      '</div>' +
      '<div class="copilot-grid">' +
        '<section>' + renderSnapshotHistory(snapshot) + '</section>' +
        '<section>' + renderHandoffChecklist(checklist) + '</section>' +
      '</div>' +
      '<div class="copilot-grid">' +
        '<section><h3>' + esc(text('Ø­Ù…Ø§ÙŠØ© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù‡Ù†Ø¯Ø³ÙŠØ©', 'Engineering Data Guardrails')) + '</h3><div class="copilot-guardrails"><span>Rules Engine source</span><span>No AI numbers</span><span>No automatic project mutation</span><span>Per-project snapshots</span></div></section>' +
        '<section><h3>' + esc(text('Ù†Ø·Ø§Ù‚ Copilot Ø§Ù„Ø­Ø§Ù„ÙŠ', 'Current Copilot Scope')) + '</h3><p class="copilot-note">' + esc(text('Ù‡Ø°Ù‡ Ø§Ù„Ù…Ø±Ø­Ù„Ø© ØªØ¯Ø¹Ù… Ø§Ù„Ù…Ø±Ø§Ø¬Ø¹Ø© ÙˆØ§Ù„ØªÙØ³ÙŠØ± ÙˆØ§Ù„ØªÙˆØ«ÙŠÙ‚. Ù„Ø§ ØªØ¹ØªÙ…Ø¯ ÙƒØªÙˆÙ‚ÙŠØ¹ Ù‡Ù†Ø¯Ø³ÙŠ Ù†Ù‡Ø§Ø¦ÙŠ Ù‚Ø¨Ù„ Ù…Ø±Ø§Ø¬Ø¹Ø© Ù…Ù‡Ù†Ø¯Ø³ HVAC.', 'This phase supports review, explanation, and documentation. It is not a final engineering sign-off without HVAC engineer review.')) + '</p></section>' +
      '</div>' +
      '<div class="copilot-grid">' +
        '<section>' + renderRiskRegister(riskRegister) + '</section>' +
        '<section><h3>' + esc(text('Ù…Ù„Ø®Øµ Ù‚Ø±Ø§Ø± Ø§Ù„ØªØ³Ù„ÙŠÙ…', 'Delivery Decision Summary')) + '</h3><p class="copilot-note">' + esc(readiness.readyForClient ? text('Ø§Ù„Ù…Ø´Ø±ÙˆØ¹ ÙŠØ¨Ø¯Ùˆ Ø¬Ø§Ù‡Ø²Ø§ Ù…Ù† Ù†Ø§Ø­ÙŠØ© Ù‚ÙˆØ§Ø¹Ø¯ Copilot Ø§Ù„Ø­Ø§Ù„ÙŠØ©ØŒ Ù…Ø¹ Ø¨Ù‚Ø§Ø¡ Ù…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„Ù…Ù‡Ù†Ø¯Ø³ Ù…Ø·Ù„ÙˆØ¨Ø©.', 'Project appears ready under current Copilot rules, with engineer review still required.') : text('ÙŠÙˆØ¬Ø¯ Ù…Ø§ ÙŠÙ…Ù†Ø¹ Ø£Ùˆ ÙŠØ¤Ø®Ø± Ø§Ù„ØªØ³Ù„ÙŠÙ…. Ø±Ø§Ø¬Ø¹ Ø³Ø¬Ù„ Ø§Ù„Ù…Ø®Ø§Ø·Ø± ÙˆÙ‚Ø§Ø¦Ù…Ø© Ø§Ù„ØªØ³Ù„ÙŠÙ… Ù‚Ø¨Ù„ Ø¥ØµØ¯Ø§Ø± Ø§Ù„ØªÙ‚Ø±ÙŠØ±.', 'Delivery is blocked or delayed. Review the risk register and handoff checklist before issuing the report.')) + '</p></section>' +
      '</div>';

    if(root.AirCalcEnforceTechnicalReportEnglishDigits){
      root.AirCalcEnforceTechnicalReportEnglishDigits();
    }

    var btn = document.getElementById('copilot-optimize-btn');
    if(btn){
      btn.onclick = function(){
        lastScenarios = root.AirCalcCopilotHealthEngine.buildOptimizationScenarios(snapshot);
        addTimelineEvent('optimize', text('ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ø³ÙŠÙ†Ø§Ø±ÙŠÙˆÙ‡Ø§Øª ØªØ­Ø³ÙŠÙ† Ù„Ù„Ù…Ø±Ø§Ø¬Ø¹Ø©', 'Optimization scenarios generated for review'), snapshot);
        refresh();
      };
    }
    var exportBtn = document.getElementById('copilot-export-btn');
    if(exportBtn){
      exportBtn.onclick = function(){
        var report = root.AirCalcCopilotHealthEngine.buildReviewReport(snapshot, health, recommendations, confidence, lastScenarios);
        addTimelineEvent('export', text('ØªÙ… ØªØµØ¯ÙŠØ± ØªÙ‚Ø±ÙŠØ± Ù…Ø±Ø§Ø¬Ø¹Ø© HVAC', 'HVAC review report exported'), snapshot);
        downloadReviewReport(report, readiness);
      };
    }
    var saveBtn = document.getElementById('copilot-save-snapshot-btn');
    if(saveBtn){
      saveBtn.onclick = function(){
        if(!root.AirCalcCopilotReviewStore || typeof root.AirCalcCopilotReviewStore.save !== 'function') return;
        var report = root.AirCalcCopilotHealthEngine.buildReviewReport(snapshot, health, recommendations, confidence, lastScenarios);
        root.AirCalcCopilotReviewStore.save(report);
        addTimelineEvent('snapshot', text('ØªÙ… Ø­ÙØ¸ Ù„Ù‚Ø·Ø© Ù…Ø±Ø§Ø¬Ø¹Ø© Ù‡Ù†Ø¯Ø³ÙŠØ©', 'Engineering review snapshot saved'), snapshot);
        refresh();
      };
    }
    var printBtn = document.getElementById('copilot-print-report-btn');
    if(printBtn){
      printBtn.onclick = function(){
        var report = root.AirCalcCopilotHealthEngine.buildReviewReport(snapshot, health, recommendations, confidence, lastScenarios);
        var readiness = root.AirCalcCopilotHealthEngine.buildDeliveryReadiness(snapshot, health, recommendations, confidence);
        var opened = openPrintableReport(report, readiness);
        addTimelineEvent(opened ? 'print-report' : 'download-report-html', opened ? text('ØªÙ… ÙØªØ­ ØªÙ‚Ø±ÙŠØ± Ù…Ø±Ø§Ø¬Ø¹Ø© Ù‚Ø§Ø¨Ù„ Ù„Ù„Ø·Ø¨Ø§Ø¹Ø©', 'Printable review report opened') : text('ØªÙ… ØªÙ†Ø²ÙŠÙ„ ØªÙ‚Ø±ÙŠØ± HTML Ù„Ù„Ø·Ø¨Ø§Ø¹Ø©', 'Printable HTML report downloaded'), snapshot);
      };
    }
    var aiBtn = document.getElementById('copilot-ai-summary-btn');
    if(aiBtn){
      aiBtn.onclick = function(){
        var report = root.AirCalcCopilotHealthEngine.buildReviewReport(snapshot, health, recommendations, confidence, lastScenarios);
        if(!root.AirCalcCopilotAIAdapter || typeof root.AirCalcCopilotAIAdapter.summarizeReview !== 'function'){
          aiSummary = {
            fallback: true,
            summary: text('Ø·Ø¨Ù‚Ø© AI ØºÙŠØ± Ù…ØªØµÙ„Ø©. Ù†ØªØ§Ø¦Ø¬ Rules Engine Ù…Ø³ØªÙ…Ø±Ø©.', 'AI adapter is not connected. Rules Engine results continue.'),
            nextStep: text('Ø±Ø§Ø¬Ø¹ Ø§Ù„ØªÙˆØµÙŠØ§Øª Ø§Ù„Ø­ÙŠØ©.', 'Review live recommendations.')
          };
          refresh();
          return;
        }
        aiSummaryPending = true;
        refresh();
        root.AirCalcCopilotAIAdapter.summarizeReview(report).then(function(result){
          aiSummary = result;
          aiSummaryPending = false;
          addTimelineEvent(result && result.fallback ? 'ai-fallback' : 'ai-summary', result && result.fallback ? text('ØªÙ… Ø§Ø³ØªØ®Ø¯Ø§Ù… Ù…Ù„Ø®Øµ Ø§Ø­ØªÙŠØ§Ø·ÙŠ Ø¹Ù†Ø¯ ÙØ´Ù„ AI', 'Fallback summary used after AI failure') : text('ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ù…Ù„Ø®Øµ AI ØªÙØ³ÙŠØ±ÙŠ', 'Explain-only AI summary generated'), snapshot);
          refresh();
        }).catch(function(){
          aiSummary = {
            fallback: true,
            summary: text('ÙØ´Ù„ Ù…Ù„Ø®Øµ AI. Ù†ØªØ§Ø¦Ø¬ Rules Engine Ù…Ø³ØªÙ…Ø±Ø©.', 'AI summary failed. Rules Engine results continue.'),
            nextStep: text('Ø±Ø§Ø¬Ø¹ Ø§Ù„ØªÙˆØµÙŠØ§Øª Ø§Ù„Ø­ÙŠØ©.', 'Review live recommendations.')
          };
          aiSummaryPending = false;
          addTimelineEvent('ai-fallback', text('ØªÙ… Ø§Ø³ØªØ®Ø¯Ø§Ù… Ù…Ù„Ø®Øµ Ø§Ø­ØªÙŠØ§Ø·ÙŠ Ø¹Ù†Ø¯ ÙØ´Ù„ AI', 'Fallback summary used after AI failure'), snapshot);
          refresh();
        });
      };
    }
    applyActiveTabView(panel);
    bindTabButtons();
    bindActionButtons(snapshot);
  }

  function refresh(){
    if(!root.AirCalcCopilotStateAdapter || !root.AirCalcCopilotHealthEngine) return;
    var snapshot = root.AirCalcCopilotStateAdapter.readProjectSnapshot();
    captureStateChange(snapshot);
    var health = root.AirCalcCopilotHealthEngine.calculateHealth(snapshot);
    var recommendations = root.AirCalcCopilotHealthEngine.buildRecommendations(snapshot, health);
    var actionState = readActionState();
    var shownRecommendations = visibleRecommendations(recommendations, actionState);
    var confidence = root.AirCalcCopilotHealthEngine.calculateConfidence(snapshot, health);
    var actionCenter = root.AirCalcCopilotHealthEngine.buildActionCenter(snapshot, shownRecommendations);
    var explanation = root.AirCalcCopilotHealthEngine.buildDecisionExplanation(snapshot, health, recommendations);
    var comparison = root.AirCalcCopilotHealthEngine.buildSmartComparison(snapshot, lastScenarios, previousSnapshot || previousSnapshotFromStore(snapshot));
    var readiness = root.AirCalcCopilotHealthEngine.buildDeliveryReadiness(snapshot, health, recommendations, confidence);
    var checklist = root.AirCalcCopilotHealthEngine.buildHandoffChecklist(snapshot, health, recommendations, confidence, readiness);
    var riskRegister = root.AirCalcCopilotHealthEngine.buildRiskRegister(snapshot, health, recommendations, readiness);
    render(snapshot, health, recommendations, shownRecommendations, confidence, actionCenter, explanation, comparison, actionState, readiness, checklist, riskRegister);
  }

  function schedule(){
    if(refreshTimer) return;
    refreshTimer = root.setInterval(refresh, 1500);
    root.setTimeout(refresh, 250);
  }

  root.AppHvacDesignCopilot = {
    refresh: refresh,
    optimize: function(){
      var snapshot = root.AirCalcCopilotStateAdapter.readProjectSnapshot();
      lastScenarios = root.AirCalcCopilotHealthEngine.buildOptimizationScenarios(snapshot);
      addTimelineEvent('optimize', text('ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ø³ÙŠÙ†Ø§Ø±ÙŠÙˆÙ‡Ø§Øª ØªØ­Ø³ÙŠÙ† Ù„Ù„Ù…Ø±Ø§Ø¬Ø¹Ø©', 'Optimization scenarios generated for review'), snapshot);
      refresh();
      return lastScenarios;
    },
    summarizeWithAi: function(options){
      var snapshot = root.AirCalcCopilotStateAdapter.readProjectSnapshot();
      var health = root.AirCalcCopilotHealthEngine.calculateHealth(snapshot);
      var recommendations = root.AirCalcCopilotHealthEngine.buildRecommendations(snapshot, health);
      var confidence = root.AirCalcCopilotHealthEngine.calculateConfidence(snapshot, health);
      var report = root.AirCalcCopilotHealthEngine.buildReviewReport(snapshot, health, recommendations, confidence, lastScenarios);
      return root.AirCalcCopilotAIAdapter.summarizeReview(report, options || {});
    },
    saveReviewSnapshot: function(){
      var snapshot = root.AirCalcCopilotStateAdapter.readProjectSnapshot();
      var health = root.AirCalcCopilotHealthEngine.calculateHealth(snapshot);
      var recommendations = root.AirCalcCopilotHealthEngine.buildRecommendations(snapshot, health);
      var confidence = root.AirCalcCopilotHealthEngine.calculateConfidence(snapshot, health);
      var report = root.AirCalcCopilotHealthEngine.buildReviewReport(snapshot, health, recommendations, confidence, lastScenarios);
      return root.AirCalcCopilotReviewStore.save(report);
    }
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', schedule);
  }else{
    schedule();
  }
})(typeof window !== 'undefined' ? window : globalThis, document);
