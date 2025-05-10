import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

const client = createClient({
  url: "libsql://chat-darjss.aws-ap-northeast-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NDY4NTIxMTQsImlkIjoiMzZiNzdlOWYtZjk3MS00ODA2LWE2MmQtZDgyNTdhMTdlZDE2IiwicmlkIjoiNTU3YzQ1ZjctYmJjOC00NDRjLWE5ZTYtNWFmZWMwODRlNDAzIn0.6oWgV4SPscetfLF--Ew8yBQDDAZ-V-f8t4twF_GUBYTcTu1SA4NB21XNLUrnUnR2_sQuCVqKyoJmV6YtSywaCg",
});

export const db = drizzle({ client });
