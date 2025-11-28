import { NextResponse } from "next/server";
import { getArticleHeadlinesAction } from "@/app/actions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || undefined;

  try {
    const result = await getArticleHeadlinesAction(date);

    if (Array.isArray(result)) {
      return NextResponse.json(result, { status: 200 });
    }

    return NextResponse.json(result, { status: 500 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch articles" },
      { status: 500 }
    );
  }
}
