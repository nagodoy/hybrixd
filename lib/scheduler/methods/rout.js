const router = require('../../router/router');
const CHILD_REFERENCE_ID = 0; // provide a non true childReferenceId to prevent process from failing if adopted process fails
/**
   * Route a path through hybrixd and pass the result to the next step. /api/help for API information.
   * @param {String} path - Provide the routing path
   * @example
   * rout '/asset/dummy/balance/__dummyaddress__'    // retrieve the balance for the dummy asset
   * rout '/asset/dummy/fee' @success @failure       // retrieve the fee for the dummy asset, on success jump to @success, else jump to @failure
   */
exports.rout = data => function (p, xpath, onSuccess, onFailure) {
  const sessionID = p.getSessionID();
  const result = router.route({url: xpath, sessionID: sessionID, data, hideInLogs: true});
  if (result.id === 'id') { // if result is a process that has te be awaited, then read that proces until finished
    const processID = result.data;
    // make the process a child process of current process p
    const callback = (error, data) => {
      if (error === 0) return p.jump(onSuccess || 1, data);
      else if (typeof onFailure === 'undefined') return p.fail(data);
      else return p.jump(onFailure, data);
    };
    p.adopt(processID, CHILD_REFERENCE_ID, callback);
  } else {
    p.help(result.help);
    p.mime(result.type);
    const data = result.hasOwnProperty('data') ? result.data : null;
    if (!result.hasOwnProperty('error') || result.error === 0) return p.jump(onSuccess || 1, data);
    else if (typeof onFailure === 'undefined') return p.fail(data);
    else return p.jump(onFailure, data);
  }
};
