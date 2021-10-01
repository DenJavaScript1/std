// @deno-types="https://unpkg.com/@types/chai@4.2.22/index.d.ts"
import "https://chaijs.com/chai.js";

Deno.test("we can make chai assertions", () => {
  const assert = chai.assert;
  const foo = "bar";
  const beverages = { tea: ["chai", "matcha", "oolong"] };

  assert.typeOf(foo, "string"); // without optional message
  assert.typeOf(foo, "string", "foo is a string"); // with optional message
  assert.equal(foo, "bar", "foo equal `bar`");
  assert.lengthOf(foo, 3, "foo`s value has a length of 3");
  assert.lengthOf(beverages.tea, 3, "beverages has 3 types of tea");
});

Deno.test("we can make chai expectations", () => {
  const expect = chai.expect;
  const foo = "bar";
  const beverages = { tea: ["chai", "matcha", "oolong"] };

  expect(foo).to.be.a("string");
  expect(foo).to.equal("bar");
  expect(foo).to.have.lengthOf(3);
  expect(beverages).to.have.property("tea").with.lengthOf(3);
});

Deno.test("we can use chai should style", () => {
  chai.should();
  const foo = "bar";
  const beverages = { tea: ["chai", "matcha", "oolong"] };

  foo.should.be.a("string");
  foo.should.equal("bar");
  foo.should.have.lengthOf(3);
  beverages.should.have.property("tea").with.lengthOf(3);
});
