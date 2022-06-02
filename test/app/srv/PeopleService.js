const { ApplicationService, cwdRequireCDS } = require("cds-internal-tool");


/**
 * 
 * @param {ApplicationService} srv 
 */
module.exports = async (srv) => {
  const cds = cwdRequireCDS();
  const { People } = srv.entities;
  const { changeAmount, updateName, updateAge } = srv.events
  const { updateWeight, multiErrors } = srv.operations;
  
  srv.on(changeAmount, async (req) => {
    const { data, user } = req;
    const people = await srv.run(cds.ql.SELECT.one.from(People, data.peopleID));
    if (people !== null) {
      await srv.run(cds.ql.UPDATE.entity(People).set({ Amount: data.amount }).byKey(data.peopleID));
    }
  });

  srv.on(multiErrors, async (req) => {
    req.warn("NOT_SUPPORTED")
    req.error('400', "ERROR_1")
    return req.error("FATAL: error")
  })

  srv.on(updateWeight, async (req) => {
    const { data } = req
    await srv.run(cds.ql.UPDATE.entity(People).set({ Weight: data.Weight }).byKey(data.ID))
    return srv.run(cds.ql.SELECT.one.from(People, data.ID))
  })

  srv.on(updateName, async (req) => {
    const { data, user } = req;
    await srv.run(cds.ql.UPDATE.entity(People).set({ Name: data.Name }).byKey(data.peopleID));
  });


  srv.on(updateAge, async (req) => {
    const { data, user } = req;
    await srv.run(cds.ql.UPDATE.entity(People).set({ Age: data.Age }).byKey(data.peopleID));
  });

};
