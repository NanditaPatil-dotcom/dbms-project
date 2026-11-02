// ============================================================================
// CampusQuery  |  MongoDB collections (flexible / unstructured knowledge)
// MySQL holds users, FAQs, feedback, bookmarks, history: see database/mysql/
// Run with:  mongosh "mongodb://localhost:27017" database/mongodb/init.js
// ============================================================================
use("CampusQuery");

db.knowledge_documents.drop();
db.document_chunks.drop();
db.faq_enrichment.drop();

// ---------------------------------------------------------------------------
// Validators: MongoDB is schema-flexible, but the core fields are enforced.
// ---------------------------------------------------------------------------
db.createCollection("knowledge_documents", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["document_id", "mysql_document_id", "title", "department", "document_type", "content", "tags", "source"],
    properties: {
      document_id:       { bsonType: "string", pattern: "^DOC[0-9]{3,}$" },
      mysql_document_id: { bsonType: "int", description: "DOCUMENT.document_id in MySQL" },
      title:             { bsonType: "string" },
      department:        { bsonType: "string", description: "DEPARTMENT.department_code in MySQL" },
      document_type:     { bsonType: "string" },
      content:           { bsonType: "string" },
      tags:              { bsonType: "array", items: { bsonType: "string" } },
      source:            { bsonType: "string" }
    }
  } }
});
db.createCollection("document_chunks", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["document_id", "chunk_index", "chunk_text"],
    properties: {
      document_id: { bsonType: "string" },
      chunk_index: { bsonType: "int", minimum: 0 },
      chunk_text:  { bsonType: "string" },
      metadata:    { bsonType: "object" }
    }
  } }
});
db.createCollection("faq_enrichment", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["faq_id", "tags", "keywords"],
    properties: {
      faq_id:               { bsonType: "int", description: "FAQ.faq_id in MySQL" },
      tags:                 { bsonType: "array", items: { bsonType: "string" } },
      keywords:             { bsonType: "array", items: { bsonType: "string" } },
      related_document_ids: { bsonType: "array", items: { bsonType: "string" } }
    }
  } }
});

// ---------------------------------------------------------------------------
// knowledge_documents: content, tags, rules and other per-document shapes
// ---------------------------------------------------------------------------
db.knowledge_documents.insertMany([
  {
    document_id: "DOC001", mysql_document_id: NumberInt(1),
    title: "Academic Regulations 2026", department: "CSE", document_type: "Regulation",
    content: "Students must maintain the required attendance before appearing for semester examinations. A minimum of 75% attendance in each registered course is expected, and shortage may be condoned only with documented reasons approved by the department.",
    tags: ["attendance", "examination", "academics", "condonation"],
    source: "Academic Office"
  },
  {
    document_id: "DOC002", mysql_document_id: NumberInt(2),
    title: "Hostel Guidelines", department: "SA", document_type: "Guidelines",
    content: "Students must follow hostel entry timings and visitor policies. Leave requests, quiet hours and maintenance complaints are handled by the hostel office.",
    rules: ["Follow hostel entry timings", "Follow hostel visitor policy"],
    tags: ["hostel", "rules", "visitors", "dorm"],
    source: "Hostel Administration"
  },
  {
    document_id: "DOC003", mysql_document_id: NumberInt(3),
    title: "Internship Guidelines", department: "CSE", document_type: "Guidelines",
    content: "Students must submit the required documents for internship approval before the internship begins. The department reviews each request and records the approval.",
    requirements: ["Internship offer letter", "Department approval", "Internship application form"],
    tags: ["internship", "approval", "placement"],
    source: "Placement Office"
  },
  {
    document_id: "DOC004", mysql_document_id: NumberInt(4),
    title: "Student Services Handbook", department: "SA", document_type: "Handbook",
    content: "Bonafide certificates, transfer letters and other student letters are requested from the student services desk with the university ID. Standard requests take three working days.",
    tags: ["certificate", "bonafide", "student services", "letters"],
    source: "Student Affairs Office"
  },
  {
    document_id: "DOC005", mysql_document_id: NumberInt(5),
    title: "Fee Refund Policy", department: "BBA", document_type: "Policy",
    content: "Fee refunds are requested through the finance office with the transaction receipt. Eligibility and processing time depend on the academic calendar.",
    steps: ["Raise a request on the portal", "Attach the transaction receipt", "Finance office reviews eligibility"],
    tags: ["fees", "refund", "finance", "payment"],
    source: "Finance Office"
  }
]);

// ---------------------------------------------------------------------------
// document_chunks: passage-level text used for snippets (MySQL DOCUMENT_CHUNK moved here)
// ---------------------------------------------------------------------------
db.document_chunks.insertMany([
  { document_id: "DOC001", chunk_index: NumberInt(0), chunk_text: "A minimum of 75% attendance in each registered course is required to write the semester examination.", metadata: { section: "Attendance", page: 4 }, created_at: new Date() },
  { document_id: "DOC001", chunk_index: NumberInt(1), chunk_text: "Attendance shortage may be condoned with a documented medical or official reason approved by the department before hall-ticket processing.", metadata: { section: "Condonation", page: 5 }, created_at: new Date() },
  { document_id: "DOC002", chunk_index: NumberInt(0), chunk_text: "Residents must return to the hostel before the published entry time. Visitors are allowed only in the designated visitor area.", metadata: { section: "Entry and visitors", page: 2 }, created_at: new Date() },
  { document_id: "DOC003", chunk_index: NumberInt(0), chunk_text: "To obtain internship approval, submit the offer letter, department approval and the internship application form.", metadata: { section: "Approval", page: 1 }, created_at: new Date() },
  { document_id: "DOC004", chunk_index: NumberInt(0), chunk_text: "A bonafide certificate is issued within three working days of a request made at the student services desk.", metadata: { section: "Certificates", page: 3 }, created_at: new Date() },
  { document_id: "DOC005", chunk_index: NumberInt(0), chunk_text: "A fee refund request must include the transaction receipt and is reviewed by the finance office.", metadata: { section: "Refund process", page: 2 }, created_at: new Date() }
]);

// ---------------------------------------------------------------------------
// faq_enrichment: flexible tags/keywords per MySQL FAQ (ids from database/mysql/seed.sql)
// ---------------------------------------------------------------------------
db.faq_enrichment.insertMany([
  { faq_id: NumberInt(1), tags: ["attendance", "examination", "eligibility"], keywords: ["75%", "attendance", "semester exam", "hall ticket"], related_document_ids: ["DOC001"] },
  { faq_id: NumberInt(2), tags: ["certificate", "bonafide"], keywords: ["bonafide", "certificate", "student letter", "proof of enrollment"], related_document_ids: ["DOC004"] },
  { faq_id: NumberInt(3), tags: ["registration", "electives"], keywords: ["elective", "course registration", "add drop"], related_document_ids: ["DOC001"] },
  { faq_id: NumberInt(4), tags: ["internship", "approval"], keywords: ["internship", "offer letter", "approval", "placement"], related_document_ids: ["DOC003"] },
  { faq_id: NumberInt(5), tags: ["examination", "re-exam"], keywords: ["re-exam", "reexam", "supplementary exam", "retake"], related_document_ids: ["DOC001"] },
  { faq_id: NumberInt(6), tags: ["hostel", "rules"], keywords: ["hostel", "dorm", "visitors", "quiet hours", "accommodation"], related_document_ids: ["DOC002"] },
  { faq_id: NumberInt(7), tags: ["attendance", "condonation"], keywords: ["attendance shortage", "condonation", "low attendance"], related_document_ids: ["DOC001"] },
  { faq_id: NumberInt(8), tags: ["fees", "refund"], keywords: ["fee refund", "refund", "payment", "money back"], related_document_ids: ["DOC005"] }
]);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------
db.knowledge_documents.createIndex({ document_id: 1 }, { unique: true });
db.knowledge_documents.createIndex({ mysql_document_id: 1 }, { unique: true });
db.knowledge_documents.createIndex({ department: 1 });
db.knowledge_documents.createIndex({ tags: 1 });
db.knowledge_documents.createIndex(
  { title: "text", content: "text", tags: "text" },
  { name: "knowledge_text_idx", weights: { title: 5, tags: 4, content: 1 } }
);

db.document_chunks.createIndex({ document_id: 1, chunk_index: 1 }, { unique: true });
db.document_chunks.createIndex({ chunk_text: "text" }, { name: "chunk_text_idx" });

db.faq_enrichment.createIndex({ faq_id: 1 }, { unique: true });
db.faq_enrichment.createIndex(
  { keywords: "text", tags: "text" },
  { name: "faq_enrichment_text_idx", weights: { keywords: 3, tags: 2 } }
);

print("knowledge_documents: " + db.knowledge_documents.countDocuments());
print("document_chunks:     " + db.document_chunks.countDocuments());
print("faq_enrichment:      " + db.faq_enrichment.countDocuments());
