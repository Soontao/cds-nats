namespace test.app.srv.theosun;

using {
  cuid,
  managed
} from '@sap/cds/common';

service PeopleService {

  entity People : cuid, managed {
    Name   : String(255);
    Age    : Integer;
    Weight : Decimal;
    Amount : Decimal default 0;
  }

  action   updateWeight(ID : UUID, Weight : Decimal) returns People;
  function multiErrors(ID : UUID)                    returns {};

  event changeAmount {
    peopleID : UUID;
    amount   : Decimal;
  }

  @topic : 'test.app.srv.theosun.people.broadcast'
  event updateName {
    peopleID : UUID;
    Name     : String;
    Age      : Integer;
  }

  @topic : 'test.app.srv.theosun.people.broadcast'
  event updateAge {
    peopleID : UUID;
    Name     : String;
    Age      : Integer;
  }

}
