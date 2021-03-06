var _ = require('underscore');
var async = require('async');
var Backbone = require('backbone');
var $ = require('jquery');

var ActivityCollection = window.c = require('../../../../entities/activities/activities_collection');
// var TaskCollection = require('../../../../entities/tasks/tasks_collection');
var HomeActivityView = require('./home_activity_view');
var UIConfig = require('../../../../config/ui.json');
var User = require('../../../../../utils/user');

// templates
var HomeTemplate = require('../templates/home_template.html');
var SearchTemplate = require('../templates/home_search_template.html');
var UsersTemplate = require('../templates/home_users_template.html');
var HomeCreatedTemplate = require('../templates/home_created_template.html');
var HomeParticipatedTemplate = require('../templates/home_participated_template.html');

var templates = {
  main: _.template(HomeTemplate),
  users: _.template(UsersTemplate),
  search: _.template(SearchTemplate),
  created: _.template(HomeCreatedTemplate),
  participated: _.template(HomeParticipatedTemplate),
};

var HomeView = Backbone.View.extend({
  events: {
    'click .logout'                : 'logout',
    'click .participated-show-all' : 'showAllParticipated',
    'click .created-show-all'      : 'showAllParticipated',
    'change #sort-participated'    : 'sortTasks',
    'change #sort-created'         : 'sortTasks',
  },

  initialize: function (options) {
    this.options = options;
    this.data = options.data;
  },

  render: function () {
    this.$el.html(templates.main);
    $('#search-results-loading').hide();
    this.$el.localize();

    // initialize sub components
    this.initializeParticipatedCreated();
    this.initializeSearchUsers();
    
    return this;
  },

  setTarget: function (target, inner) {
    var s = '[data-target=' + target + ']';
    $(s).html(inner);
  },

  filterArchived: function (item) { 
    return item.state != 'archived';
  },

  initializeParticipatedCreated: function () {
    if (this.volView) { this.volView.cleanup(); }
    if (this.taskView) { this.taskView.cleanup(); }
    $.ajax('/api/user/activities/' + window.cache.currentUser.id).done(function (data) {
      this.data.tasks = data.tasks;
      this.volView = new HomeActivityView({
        model: this.model,
        el: '.opportunity-participated',
        template: templates.participated,
        target: 'task',
        handle: 'volTask',  // used in css id
        data: _.sortBy(_.filter(data.tasks.volunteered, this.filterArchived), 'updatedAt').reverse(),
        getStatus: this.getStatus,
      });
      this.volView.render();

      this.taskView = new HomeActivityView({
        model: this.model,
        el: '.opportunity-created',
        template: templates.created,
        target: 'task',
        handle: 'task',  // used in css id
        data: _.sortBy(_.filter(data.tasks.created, this.filterArchived), 'updatedAt').reverse(),
      });
      this.taskView.render();
    }.bind(this));
  },

  initializeSearchUsers: function () {
    _.each(['search', 'users'], function (type) {
      this.listenTo(new ActivityCollection({ type: type }), 'activity:collection:fetch:success', function (e) {
        var data = {};
        data[type] = e.toJSON()[0];
        var html = templates[type](data);
        this.setTarget(type, html);
      }.bind(this));
    }.bind(this));
  },

  getStatus: function (task) {
    switch (task.state) {
      case 'completed':
        return (task.assigned ? (task.taskComplete ? 'Complete' : 'Not complete') : 'Not assigned');
      case 'in progress':
        return (task.assigned ? (task.taskComplete ? 'Complete' : 'Assigned') : 'Not assigned');
      case 'canceled':
        return 'Canceled';
      default:
        return (task.assigned ? 'Assigned' : 'Applied');
    }
  },

  showAllParticipated: function (e) {
    if (e.preventDefault) e.preventDefault();
    var t = $(e.currentTarget);
    
    if (t.hasClass('participated-show-all')) {
      this.volView.options.showAll = true;
      this.volView.render();
    } else {
      this.taskView.options.showAll = true;
      this.taskView.render();
    }
  },

  sortTasks: function (e) {
    var target = $(e.currentTarget)[0];
    var data = this.data.tasks[target.id == 'sort-participated' ? 'volunteered' : 'created'];
    var sortedData = [];
    if(target.id == 'sort-participated' && target.value == 'state') {
      sortedData = _.sortBy(_.filter(data, this.filterArchived), function (item) {
        return this.getStatus(item);
      }.bind(this));
    } else {
      sortedData = _.sortBy(_.filter(data, this.filterArchived), target.value);
    }
    if(target.value == 'updatedAt') {
      sortedData = sortedData.reverse();
    }
    if(target.id == 'sort-participated') {
      this.volView.options.sort = target.value;
      this.volView.options.data = sortedData;
      this.volView.render();
    } else {
      this.taskView.options.sort = target.value;
      this.taskView.options.data = sortedData;
      this.taskView.render();
    }
  },

  logout: function (e) {
    if (e.preventDefault) e.preventDefault();
    $.ajax({
      url: '/api/auth/logout?json=true',
    }).done(function (data) {
      window.cache.currentUser = null;
      if(data.redirectURL) {
        window.location = data.redirectURL;
      } else {
        window.cache.userEvents.trigger('user:logout');
      }
    }).fail(function (error) {
      // do nothing
    });
  },

  cleanup: function () {
    this.$el.removeClass('home');
    removeView(this);
  },
});

module.exports = HomeView;
