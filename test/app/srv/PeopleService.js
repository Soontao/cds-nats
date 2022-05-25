const { ApplicationService, cwdRequireCDS } = require("cds-internal-tool");


/**
 * 
 * @param {ApplicationService} srv 
 */
module.exports = async (srv) => {
  const cds = cwdRequireCDS();
  const { People } = srv.entities;
  const { changeAmount } = srv.events
  srv.on(changeAmount, async (req) => {
    const { data, user } = req;
    const people = await srv.run(cds.ql.SELECT.one.from(People, data.peopleID));
    if (people !== null) {
      await srv.run(cds.ql.UPDATE.entity(People).set({ Amount: data.amount }).byKey(data.peopleID));
    }
  });
};
