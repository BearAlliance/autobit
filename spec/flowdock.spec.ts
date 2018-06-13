import { Flowdock } from '../src/flowdock';
import * as ht from 'typed-rest-client/HttpClient';
import { Mock } from 'ts-mocks';

describe('first', () => {
  let fd: Flowdock;

  beforeEach(() => {
    fd = new Flowdock('foo', 'bar', 'baz');
    fd.http = new Mock<ht.HttpClient>().Object;
  });
});
