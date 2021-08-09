// Install Third Party Dependencies
eval(UrlFetchApp.fetch('https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js').getContentText());

const Utils = {
  afterDate: function() {
      return moment.utc().subtract(1, 'week').subtract(1, 'days')
  }
}
