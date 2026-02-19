Using Serial primary keys in database id stategy as  no uuid no maping later is required and its simple, agentic friendly.

 GIN index, every search query does a full table scan.
 The GIN index pre-computes the text vectors and stores them in a search-optimized structure. PostgreSQL can jump directly to matching rows instead of scanning everything. so less ms to retirve