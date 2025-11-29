import { NextResponse } from "next/server";
import { transformAiTipAction } from "@/app/actions";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const text = typeof body?.text === "string" ? body.text : "";

  const result = await transformAiTipAction(text);

  if (result.tip) {
    return NextResponse.json(result, { status: 200 });
  }

  return NextResponse.json(result, { status: 400 });
}
