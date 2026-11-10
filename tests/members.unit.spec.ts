import { expect, test } from "@playwright/test";
import { escapeLike, parseMemberQuery } from "@/lib/members";

// Unit test parsing search params direktori member (spec US-5).
// Param URL tidak trusted, jadi nilai asing harus jatuh ke default.

test("tanpa param: default pencarian kosong dan urut gear score", () => {
  expect(parseMemberQuery({})).toEqual({
    q: "",
    rank: "",
    className: "",
    online: "all",
    sort: "gear",
  });
});

test("nilai di-trim dan param berulang diambil yang pertama", () => {
  const query = parseMemberQuery({
    q: ["  Ari  ", "lain"],
    rank: " WARLORD ",
    class: "Creator",
    online: "online",
    sort: "name_desc",
  });

  expect(query).toEqual({
    q: "Ari",
    rank: "WARLORD",
    className: "Creator",
    online: "online",
    sort: "name_desc",
  });
});

test("sort dan status asing jatuh ke default", () => {
  const query = parseMemberQuery({ sort: "gear_score;drop table", online: "idle" });

  expect(query.sort).toBe("gear");
  expect(query.online).toBe("all");
});

test("kunci bawaan object tidak lolos sebagai sort", () => {
  // `in` juga mencocokkan properti prototype; sort harus milik SORTS sendiri.
  expect(parseMemberQuery({ sort: "toString" }).sort).toBe("gear");
  expect(parseMemberQuery({ sort: "__proto__" }).sort).toBe("gear");
});

test("wildcard ILIKE pada nama di-escape supaya literal", () => {
  expect(escapeLike("100%_fun")).toBe("100\\%\\_fun");
  expect(escapeLike("back\\slash")).toBe("back\\\\slash");
});
