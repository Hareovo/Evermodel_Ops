import { readStorage, writeStorage } from './TableCard';

describe('TableCard storage', () => {
  beforeEach(() => localStorage.clear());

  test('reads only versioned valid data and tolerates malformed storage', () => {
    localStorage.setItem('TableFields', '{bad');
    expect(readStorage()).toEqual({});
    localStorage.setItem('TableFields', JSON.stringify({version: 2, data: {hosts: ['name']}}));
    expect(readStorage()).toEqual({hosts: ['name']});
    localStorage.setItem('TableFields', JSON.stringify({version: 1, data: {hosts: ['name']}}));
    expect(readStorage()).toEqual({});
  });

  test('writes stable versioned storage', () => {
    writeStorage({hosts: ['dataIndex']});
    expect(JSON.parse(localStorage.getItem('TableFields'))).toEqual({version: 2, data: {hosts: ['dataIndex']}});
  });
});
