const { ApplicationService, cwdRequireCDS } = require("cds-internal-tool");


/**
 * 
 * @param {ApplicationService} srv 
 */
module.exports = async (srv) => {
  const cds = cwdRequireCDS();
  const { People } = srv.entities;
  const { changeAmount, updateName, updateAge } = srv.events
  srv.on(changeAmount, async (req) => {
    const { data, user } = req;
    const people = await srv.run(cds.ql.SELECT.one.from(People, data.peopleID));
    if (people !== null) {
      await srv.run(cds.ql.UPDATE.entity(People).set({ Amount: data.amount }).byKey(data.peopleID));
    }
  });

  srv.on(updateName, async (req) => {
    const { data, user } = req;
    await srv.run(cds.ql.UPDATE.entity(People).set({ Name: data.Name }).byKey(data.peopleID));
  });


  srv.on(updateAge, async (req) => {
    const { data, user } = req;
    await srv.run(cds.ql.UPDATE.entity(People).set({ Age: data.Age }).byKey(data.peopleID));
  });
  
};
