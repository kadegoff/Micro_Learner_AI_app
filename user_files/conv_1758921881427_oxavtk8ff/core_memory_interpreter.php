{
  "id": "68d7049a7a206_1758921882",
  "filename": "core_memory_interpreter.php",
  "language": "php",
  "executable": true,
  "sections": {
    "interpret_function_definition": {
      "type": "function",
      "name": "interpretWithCoreMemories Function Definition",
      "start_line": 1,
      "end_line": 26,
      "content": "private function interpretWithCoreMemories($userId, $query)\n    {\n        global $debuglog;\n\n        // Get user's core memories\n        $coreMemoryIds = $this->redis->zRange($this->coreMemoryPrefix . \"user:{$userId}\", 0, -1);\n\n        foreach ($coreMemoryIds as $coreMemoryId) {\n            $coreMemoryKey = $this->coreMemoryPrefix . $coreMemoryId;\n            $pattern = $this->redis->hGet($coreMemoryKey, 'pattern');\n            $interpretation = $this->redis->hGet($coreMemoryKey, 'interpretation');\n\n            if (preg_match('/' . preg_quote($pattern, '/') . '/', $query)) {\n                // Increment usage count\n                $this->redis->hIncrBy($coreMemoryKey, 'usage_count', 1);\n\n                $debuglog[] = \"Core memory pattern matched: $interpretation\";\n                return [\n                    'original' => $query,\n                    'interpreted' => $interpretation,\n                    'pattern_matched' => $pattern\n                ];\n            }\n        }\n\n        return ['original' => $query, 'interpreted' => $query, 'pattern_matched' => null];\n    }",
      "relevance": "direct"
    },
    "core_memory_retrieval": {
      "type": "code_block",
      "name": "Retrieve Core Memory IDs",
      "start_line": 6,
      "end_line": 8,
      "content": "$coreMemoryIds = $this->redis->zRange($this->coreMemoryPrefix . \"user:{$userId}\", 0, -1);",
      "relevance": "direct"
    },
    "pattern_matching_loop": {
      "type": "loop",
      "name": "Pattern Matching Loop",
      "start_line": 11,
      "end_line": 20,
      "content": "foreach ($coreMemoryIds as $coreMemoryId) {\n            $coreMemoryKey = $this->coreMemoryPrefix . $coreMemoryId;\n            $pattern = $this->redis->hGet($coreMemoryKey, 'pattern');\n            $interpretation = $this->redis->hGet($coreMemoryKey, 'interpretation');\n\n            if (preg_match('/' . preg_quote($pattern, '/') . '/', $query)) {\n                // Increment usage count\n                $this->redis->hIncrBy($coreMemoryKey, 'usage_count', 1);\n\n                $debuglog[] = \"Core memory pattern matched: $interpretation\";",
      "relevance": "direct"
    },
    "successful_match_return": {
      "type": "code_block",
      "name": "Return on Successful Match",
      "start_line": 21,
      "end_line": 25,
      "content": "return [\n                    'original' => $query,\n                    'interpreted' => $interpretation,\n                    'pattern_matched' => $pattern\n                ];",
      "relevance": "direct"
    },
    "no_match_return": {
      "type": "code_block",
      "name": "Return on No Match",
      "start_line": 27,
      "end_line": 29,
      "content": "return ['original' => $query, 'interpreted' => $query, 'pattern_matched' => null];",
      "relevance": "direct"
    }
  }
}