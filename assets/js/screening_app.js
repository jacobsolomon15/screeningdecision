/* screening_app.js
 * Controlling the UI for the colorectal cancer screening app */

// define some globals

var full_data, graph_data, table_data;
var padding = 10;
var anchors;
var anchordata;
var guideline_case;
//hardcoding which var is harm and benefit for now, this will be user-specified later on
var harmvar,
    benefitvar;

var harmcolor = "#d95f02";
var benefitcolor = '#1b9e77';

var always_shape = 'circle',
    guideline_shape = 'triangle-up',
    never_shape = 'cross';

var patients = {
    'always': 'High benefit patient',
    'guideline': 'Guideline patient',
    'never': 'Low benefit patient'
}

var outcomes = {
    "deaths_prevent": "Deaths prevented",
    "cases_prevent": "Cases prevented",
    "serious_gi": "Serious GI complications requiring hospitalization",
    "other_gi": "Other GI complications requiring hospitalization",
    "cardio": "Cardiovascular complications requiring hospitalization",
    "cost": "Cost per QALY gained",
    "any": 'Any complication requiring hospitalization'
}


var current_max = 35;


//dimensions
var margins = {top: 30, bottom: 30, left: 30, right:30},
    width = $('#harm-ben-graph').width() - margins.left - margins.right,
    height = (width / 2) - margins.top - margins.bottom;

// Load the page

$(document).ready(function(){
    //pull in the full data set
    $.ajax({
        url: 'full.json',
        datatype: "json",
        async: false,
        success: function(data) {
        full_data = data;
        }
    });

    // Create an 'any' complications category
    _.each(full_data, function(row){
      row['any'] = parseFloat(row['cardio']) + parseFloat(row['serious_gi']) + parseFloat(row['other_gi']);
    });

    $('[data-toggle="popover"]').popover({
        container: 'body'
        });


    setOutcomes();

    // set the anchor data set
    setAnchors();
    //execute other functions

    setFilteredData("graph");
    setFilteredData("table");
    buildLineGraph();
    buildCostGraph();
    fillTable();

});

$("#ommitted-alert").hide();


// When the inputs are changed, change the graph
$('#graph-inputs').change(function(){
    setOutcomes();
    setAnchors();
    setFilteredData("graph");
    updateLineGraph();
    //updateCostGraph();
    //fillTable();
});

// Same for the table
$("#table-inputs").change(function(){
    setAnchors();
    setFilteredData("table");
    fillTable();
});

$("#outcome-form").change(function(){
   setOutcomes();
   setAnchors();
   updateLineGraph();
});

$("#age-form").change(function(){
   fillTable();
});

// Fix an issue with the legend by redrawing the harm/benefit tab every time the tab is shown
$('a[data-toggle="tab"]').on('shown.bs.tab', function(e){
    if (e.target.id=='line-graph-tab-link') {
        updateLineGraph();
    }
});


// Function to initialize the line graph
function buildLineGraph(){

    var linegraphdiv = $("#harm-ben-graph");
    linegraphdiv.html("");
    $(".line-legend").html("");
    if (linegraphdiv.length) {
      $(".age_form").hide();
    }

    // pull out the specific harms and benefits variables
    // NOTE- in the future the use may define which variable acts as a harm or benefit
    var harms = _.map(graph_data, function(item) {return _.pick(item, 'age', harmvar);});
    var benefits = _.map(graph_data, function(item) {return _.pick(item, 'age', benefitvar);});

    //// create the graph


    var svg = d3.select("#harm-ben-graph")
        .append('svg')
        .attr('height', height + 2*padding)
        .attr('width', width);

    var xScale = d3.scale.linear()
        .domain([66,85])
        .range([45+margins.left,width-margins.right]);

    var yScale = d3.scale.linear()
        .domain([current_max,0])
        .range([padding, height-padding - margins.bottom]);

    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient('bottom')
        .ticks(25);
    var yAxis = d3.svg.axis()
        .scale(yScale)
        .orient('left')
        .ticks(10);

    svg.append("g")
        .attr('transform', 'translate(0, '+(height - margins.bottom)+')')
        .attr('class','x axis')
        .call(xAxis);

    svg.append("g")
        .attr("transform", "translate(" + (40+margins.left) + ",0)")
        .attr('class','y axis')
        .call(yAxis);

    svg.append('text')
        .attr('x', width/2)
        .attr('y', height)
        .style('text-anchor', 'middle')
        .text('Age');

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', margins.left)
        .attr('x', 0-(height/2))
        .style('text-anchor', 'middle')
        .text('Events per 1000 screenings');



    var harmLineGen = d3.svg.line()
        .x(function(d) {
          return xScale(d.age);
        })
        .y(function(d) {
          return yScale(d[harmvar]);
        });

    var benefitLineGen = d3.svg.line()
        .x(function(d) {
          return xScale(d.age);
        })
        .y(function(d) {
          return yScale(d[benefitvar]);
        });

    svg.append("svg:path")
        .attr('d', harmLineGen(harms))
        .attr('stroke', harmcolor)
        .attr('stroke-width', 4)
        .attr('fill', 'none')
        .attr('class', 'harmline')
        .attr('data-legend', harmvar);

    svg.append("svg:path")
        .attr('d', benefitLineGen(benefits))
        .attr('stroke', benefitcolor)
        .attr('stroke-width', 4)
        .attr('fill', 'none')
        .attr('class', 'benefitline')
        .attr('data-legend', benefitvar);

}


// Return the list of input_ids (1 per age) that match the provided input values
function getInputsIdList(ins){

    var inputs_id_string = makeInputsIdString(ins);

    // build an inputs_id and add it to a list
    var inputs_id_list = {};

    for (age=66; age<86; age++) {
      var inputs_id = inputs_id_string.replace("#", age);
      inputs_id_list[inputs_id] = true; //gives a value of true to each id as required by the underscore.js filtering function that this list is created for
    }

    return inputs_id_list;
}

function makeInputsIdString(ins) {
    // pull out the specific input values
    var race = _.findWhere(ins, {'name': 'race'})['value'];
    var gender = _.findWhere(ins, {'name': 'gender'})['value'];
    var history = _.findWhere(ins, {'name': "history"})['value'];
    var comorbidity = _.findWhere(ins, {'name': 'comorbidity'})['value'];
    var rr = _.findWhere(ins, {'name': 'rr'})['value'];

    // convert 0's and 1's to letters as used in the input ids
    if (race == 0) {
      race = "B";
    } else {
      race = "W";
    }

    if (gender == 0) {
      gender = "F";
    } else {
      gender = "M";
    }

    var inputsIdString = race+gender+'_#_'+history+'_'+comorbidity+'_'+rr;
    return inputsIdString;

}

function updateLineGraph() {

    $("#ommitted-alert").hide();
    var harms = _.map(graph_data, function(item) {return _.pick(item, 'age', harmvar);});
    var benefits = _.map(graph_data, function(item) {return _.pick(item, 'age', benefitvar);});
    var harmmax = _.max(harms, function(p){return p[harmvar]})[harmvar];
    var benmax = _.max(benefits, function(p){return p[benefitvar]})[benefitvar];
    console.log(harmmax);

    if (harmmax > current_max || benmax > current_max) {
        console.log("$$$$$$");
        $('#ommitted-alert').show();
    }

    var xScale = d3.scale.linear()
      .domain([66,85])
      .range([45 + margins.left,width - margins.right]);

    var yScale = d3.scale.linear()
      .domain([current_max,0])
      .range([padding, height-padding-margins.bottom]);

    var harm = d3.select(".harmline");
    var ben = d3.select(".benefitline");

    var harmLineGen = d3.svg.line()
      .x(function(d) {
        return xScale(d.age);
      })
      .y(function(d) {
        return yScale(d[harmvar]);
      });



    var benefitLineGen = d3.svg.line()
      .x(function(d) {
        return xScale(d.age);
      })
      .y(function(d) {
        return yScale(d[benefitvar]);
      });

    harm
      .transition()
      .attr('d', harmLineGen(harms));



    ben
      .transition()
      .attr('d', benefitLineGen(benefits));

    var g_harm = d3.select('.guideline_harm');
    var g_benefit = d3.select('.guideline_benefit');



    g_harm
      .transition()
      .attr('y1', yScale(guideline_case[harmvar]))
      .attr('y2', yScale(guideline_case[harmvar]));

    g_benefit
      .transition()
      .attr('y1', yScale(guideline_case[benefitvar]))
      .attr('y2', yScale(guideline_case[benefitvar]));


    // update axis
    var yAxis = d3.svg.axis()
        .scale(yScale)
        .orient('left')
        .ticks(10);

    d3.select('g.y.axis')
        .call(yAxis);


    prepAnchorData();

}

function setAnchors() {

    var graph_ins = $("#graph-inputs").serializeArray();

    var race = _.findWhere(graph_ins, {'name': 'race'})['value'];
    var gender = _.findWhere(graph_ins, {'name': 'gender'})['value'];

    var always = [
      {'name': 'age', 'value': 66},
      {'name': 'history', 'value': 0},
      {'name': 'comorbidity', 'value': 0},
      {'name': 'race', 'value': race},
      {'name': 'gender', 'value': gender},
      {'name': 'rr', 'value':'1.00'}
    ];

    var guideline = [
      {'name': 'age', 'value': 75},
      {'name': 'history', 'value': 10},
      {'name': 'comorbidity', 'value': 2},
      {'name': 'race', 'value': race},
      {'name': 'gender', 'value': gender},
      {'name': 'rr', 'value': '1.00'}
    ];

    var never = [
      {'name': 'age', 'value': 85},
      {'name': 'history', 'value': 10},
      {'name': 'comorbidity', 'value': 3},
      {'name': 'race', 'value': race},
      {'name': 'gender', 'value': gender},
      {'name':'rr', 'value':'1.00'}
    ];

    var always_str = makeInputsIdString(always).replace('#', 66);
    var never_str = makeInputsIdString(never).replace('#', 85);
    var guideline_str = makeInputsIdString(guideline).replace('#', 75);

    var always_dat = {},
        never_dat = {},
        guideline_dat = {};

    always_dat = _.findWhere(full_data, {'inputs_id': always_str});
    never_dat = _.findWhere(full_data, {'inputs_id': never_str});
    guideline_dat = _.findWhere(full_data, {'inputs_id': guideline_str});
    always_dat['patient_type'] = 'always';
    always_dat['shape'] = always_shape;
    never_dat['patient_type'] = 'never';
    never_dat['shape'] = never_shape;
    guideline_dat['patient_type'] = 'guideline';
    guideline_dat['shape'] = guideline_shape;


    anchors = [always_dat, guideline_dat, never_dat];



}

function prepAnchorData() {
    var varnames = [benefitvar, harmvar]
    anchordata = varnames.map(function(anchordata) {
       return anchors.map(function(d) {
            if (anchordata == benefitvar) {
                var out_type = "benefit";
            } else {
                var out_type = "harm";
            }

            var row = {age: d.age, y: d[anchordata], patient_type: d.patient_type, shape: d.shape, outcome: anchordata, outcome_type: out_type};
            return row;
        });
    });


    anchordata = anchordata.reduce(function(a,b) {
        return a.concat(b);
    });

}

function setOutcomes() {
    harmvar = $('#harm-input').find(':selected').val();
    benefitvar = $('#benefit-input').find(":selected").val();
}

function setFilteredData(type) {
        // Pull in the values checked in the input form
    var ins = $( "#"+type+"-inputs").serializeArray();

    // Call a function to create a list of input_ids that match the given input values
    var inputs_id_list = getInputsIdList(ins);

    // create a filtered dataset of all ages for the given inputs
    if(type=="graph"){
        graph_data = _.filter(full_data, function(item){
            return inputs_id_list[item.inputs_id]
        })
    } else {
    table_data = _.filter(full_data, function(item){
        return inputs_id_list[item.inputs_id];
    });
    }
}


function buildCostGraph() {
    var costgraphdiv = $("#cost-graph");
    costgraphdiv.html("");

    var cost_data = _.map(graph_data, function(item) {return _.pick(item, 'age', 'cost');});
    var starting = 0;
    var ending = _.findIndex(cost_data, function(item){
      return item['cost'] > 99;
    });

    if (ending < 0) {
      ending = 19;
    }
    cost_data = _.rest(_.first(cost_data, ending + 1), starting);

    var svg = d3.select("#cost-graph")
        .append('svg')
        .attr('height', height + 2*padding)
        .attr('width', width);

    var xScale = d3.scale.linear()
        .domain([66,85])
        .range([45+margins.left,width-margins.right]);

    var yScale = d3.scale.linear()
        .domain([100,0])
        .range([padding, height-padding - margins.bottom]);

    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient('bottom')
        .ticks(25);
    var yAxis = d3.svg.axis()
        .scale(yScale)
        .orient('left')
        .ticks(5)
        .tickFormat(function(d,i){
            if (d < 100) {
                return '$' + d + 'K';
            } else {
                return '$100K+';
            }
            });

    svg.append("g")
        .attr('transform', 'translate(0, '+(height - margins.bottom)+')')
        .attr('class','x axis')
        .call(xAxis);

    svg.append("g")
        .attr("transform", "translate(" + (40+margins.left) + ",0)")
        .attr('class','y axis')
        .call(yAxis);

    svg.append('text')
        .attr('x', width/2)
        .attr('y', height)
        .style('text-anchor', 'middle')
        .text('Age');

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', margins.left)
        .attr('x', 0-(height/2))
        .style('text-anchor', 'middle')
        .text('Cost per QALY gained');


    var costLineGen = d3.svg.line()
        .x(function(d) {
          return xScale(d.age);
        })
        .y(function(d) {
          return yScale(d['cost']);
        });

    svg.append("svg:path")
        .attr('d', costLineGen(cost_data))
        .attr('stroke', "forestgreen")
        .attr('stroke-width', 4)
        .attr('fill', 'none')
        .attr('class', 'costline')
        .attr('data-legend', "cost");
}

function fillTable(){
    $('.table-cell').each(function(){

        var classes = $(this).attr('class').split(' ');
        var outcome = classes[1];
        var patient = classes[2];
        if (patient == 'patient') {
            var age = $('#table-age').find(":selected").val();
            var val = _.findWhere(table_data, {'age': age})[outcome];
        } else{
            var val = _.findWhere(anchors, {'patient_type': patient})[outcome];
        }
        $(this).html(val);
    })
}
