import { describe, it, expect } from "vitest";
import { validateSocialUrl } from "./socialValidation";

describe("validateSocialUrl", () => {
  // Valid Instagram URLs
  it("accepts https instagram URL", () => expect(validateSocialUrl("https://instagram.com/johndoe")).toBeNull());
  it("accepts www instagram URL", () => expect(validateSocialUrl("https://www.instagram.com/johndoe")).toBeNull());
  it("accepts http instagram URL", () => expect(validateSocialUrl("http://instagram.com/johndoe")).toBeNull());
  it("accepts trailing slash", () => expect(validateSocialUrl("https://instagram.com/johndoe/")).toBeNull());
  it("accepts IG with dots/underscores", () => expect(validateSocialUrl("https://instagram.com/john.doe_123")).toBeNull());

  // Valid LinkedIn URLs
  it("accepts https linkedin URL", () => expect(validateSocialUrl("https://linkedin.com/in/john-doe")).toBeNull());
  it("accepts www linkedin URL", () => expect(validateSocialUrl("https://www.linkedin.com/in/john-doe-123")).toBeNull());
  it("accepts trailing slash linkedin", () => expect(validateSocialUrl("https://linkedin.com/in/john-doe/")).toBeNull());

  // Invalid inputs
  it("rejects empty", () => expect(validateSocialUrl("")).not.toBeNull());
  it("rejects plain handle", () => expect(validateSocialUrl("johndoe")).not.toBeNull());
  it("rejects @handle", () => expect(validateSocialUrl("@johndoe")).not.toBeNull());
  it("rejects random URL", () => expect(validateSocialUrl("https://twitter.com/johndoe")).not.toBeNull());
  it("rejects special chars in handle", () => expect(validateSocialUrl("https://instagram.com/john!doe")).not.toBeNull());
  it("rejects spaces", () => expect(validateSocialUrl("https://instagram.com/john doe")).not.toBeNull());
});
