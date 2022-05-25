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

  event changeAmount {
    peopleID : UUID;
    amount   : Decimal;
  }

}
