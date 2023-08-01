import { projectName, projects } from "./lib/environments/firebase";

const firebaseElites = {
  "type": "service_account",
  "project_id": "elites-choice",
  "private_key_id": "77f81cf59f6df0be70fe4e5d436a1c4613672229",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDfpVi6UHBbBrtA\nHr0NmO4BYm7nO8o0h3UiNYL5onS/cWGO/qpAbkWK+h2nsJosXu0J3ElEKNlbUODl\nrOqL2dJd1VaINaOtT+IOOoLai9Vgfzu78eJOlFctIrWKWMiXotJ/JUWHxvfZfaMT\nQWTnE1yUcFFf8TCGVCrGmskjG1f68axuQM/JvHjR82eJSlcxk9TC89VwzXERC62s\nM5OHmSjvDSqKgSAekjAUCgGrOCXXft56uVUqMI7sfIVkuHDN2lMJ4HxIAa+p0KQ4\nkXdsq9zPmfgAUuSCmv5gYH9zpYcq+yCIutLEUlGoz/yVMFs0yiic1RN7PokPsqVT\nnt1GjmETAgMBAAECggEAO3MLg/NP+pJughvpq0ykr8+HpYX6OT5sv5wz5cHugNlV\n0poVja0CZXAZI/NI+FR/dCiPfUPSi3iTX9o4Ota7GeBU8T449SAP+jJJiGi1XsJT\nkaE5xCOgjMn2MgFpyQ0qIUw6EF6ukazZBYxTky1NZdP5faRyfrKu8D5DC0cAex71\nqrU9bdipl7sLi+xz/xeuq5nNdwY10wI+yC8RJBIlfBSUDrs662GSy68lgxPYJOQ0\nXc2ew6F9Qf23OpVooFC6D6foyO87/Wy9ObSUVprzMmdnasdKfhSkR7xx1QvIqGiN\nOujlXIcZD5uF+/ll0KWZ9IaxkTwaQkgL5iQcGKkd+QKBgQD3sDm/Z65RzHGIsRxb\nljTosgHE+FRTHbzeGPLYKK9rNRLo0xPAz/FvJkGidUfcH1peMbP3vG0apyujol0J\nVwibtcYcZDHI8eBfWf8NgmbVWt0FePWWQ5M2L8AbebxDo/xfGiJfNhEbmt128zCo\neLtlUxf3ilIFW7sMyUxyLRIHtwKBgQDnJpVPBrIY2Y9mgiBRV/wSriUOASA3C82h\nh53gz7T6bYTfKvvYNTaUj6XhTSqBhQ7WR5xF+NUW9zpDX4J9UcwrrVw+0F7W+HfG\nojVG2bCGeT2W2DSYxfjF76KOmVPDGw7WToPByP+Lr6B4vPGUWEmuOnYO0dHSPdwV\nl1swDwyZhQKBgDjzh0Owdk+On6hbePbCIeZDT87XfqQh2VSEDgqPyE3xRSjNp+QU\nrCHvfPX624wMlX3FFelnpPqU557XbWcBYRRUhnnuu9fFbd7e1ZtomXaDTwC8IFPt\ns8Ko1hY7NoOjCBth6fdUejiLslJwdoa2Q/h3U7JyVouu3OKCwpYaMOQfAoGBAIge\nV3SHC9/IVkLWRDPCrUVO2bFKhm8D+16w3w7hIcELN2C4DkB+7ZpEkTmA2JQXB+q1\nltg5tTpl8iB0oQItZh8eYqD20bKj9Ny67sa/MM2vnc4zmZ2Rj3L4L/DrZ8EQMQeQ\nitRWCe53SPdwxI5IA3OfJ6CIfJfjJ7RrQh6l7hSFAoGAPMKNuiNTTxGQHsvqL3Hn\ndVPbJ5tZZPcJU/ZSlaMYt9SRYcDvJJEhNUAELtIW1LDmac/DhZwbMOfNr8SyjvoF\nMBtwWGgvTOAkIf/PltJjHZC+uvVH1OuFhW0vBYFkH9SBA3clFnggjFTnA1n2XbJr\n5uFPskPsFxaLQx0HLvow5iI=\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-eswfb@elites-choice.iam.gserviceaccount.com",
  "client_id": "110069493990207996549",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-eswfb%40elites-choice.iam.gserviceaccount.com"
};
export const gcloudConfig: any = (name = projectName) => {
  switch (name) {
    case projects.elites:
      return firebaseElites;
    default:
      return {
        "type": "",
        "project_id": "",
        "private_key_id": "",
        "private_key": "",
        "client_email": "",
        "client_id": "",
        "auth_uri": "",
        "token_uri": "",
        "auth_provider_x509_cert_url": "",
        "client_x509_cert_url": ""
      };
  }
};