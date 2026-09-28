import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CountdownTimer from "./CountdownTimer";

describe("カウントダウンUI", () => {
  it("5分・7分・10分と開始・リセットを表示する", () => {
    const markup = renderToStaticMarkup(<CountdownTimer />);

    expect(markup).toContain("5分");
    expect(markup).toContain("7分");
    expect(markup).toContain("10分");
    expect(markup).toContain("07:00");
    expect(markup).toContain("開始");
    expect(markup).toContain("リセット");
  });
});
