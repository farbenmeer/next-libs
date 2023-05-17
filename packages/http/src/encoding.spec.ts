import { formData } from "./encoding";

describe('formData', () => {
  it('should add key value pairs to a FormData object', () => {
    const data = formData({
      foo: "bar",
      bar: 123,
    });
    expect(data.get("foo")).toBe("bar");
    expect(data.get("bar")).toBe("123");
  });
  it('should add embedded objects in extended url format', () => {
    const data = formData({
      foo: { bar: ["foo", { foo: 123 }] }
    });
    expect(data.get("foo[bar][0]")).toBe("foo");
    expect(data.get("foo[bar][1][foo]")).toBe("123");
  });
  it('should ignore empty values', () => {
    const data = formData({ foo: null });
    expect(data.has("foo")).toBeFalsy();
  });
});

