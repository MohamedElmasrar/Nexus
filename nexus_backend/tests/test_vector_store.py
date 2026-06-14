import pytest
from unittest.mock import MagicMock, patch
from app.services.vector_store import GeminiEmbeddingFunction

def test_gemini_embedding_function_batching():
    # Arrange
    api_key = "test-api-key"
    embedding_fn = GeminiEmbeddingFunction(api_key=api_key)
    
    # We want to test with 150 documents (which is > 100)
    docs = [f"document text {i}" for i in range(150)]
    
    # Mock response from Gemini API
    mock_embeddings_first_batch = [MagicMock(values=[0.1] * 768) for _ in range(100)]
    mock_embeddings_second_batch = [MagicMock(values=[0.2] * 768) for _ in range(50)]
    
    mock_response_1 = MagicMock()
    mock_response_1.embeddings = mock_embeddings_first_batch
    
    mock_response_2 = MagicMock()
    mock_response_2.embeddings = mock_embeddings_second_batch
    
    # Mock the Client and its models.embed_content method
    with patch("app.services.vector_store.genai.Client") as MockClient:
        mock_client_instance = MockClient.return_value
        # embed_content will be called twice, returning mock_response_1 and mock_response_2
        mock_client_instance.models.embed_content.side_effect = [mock_response_1, mock_response_2]
        
        # Act
        embeddings = embedding_fn(docs)
        
        # Assert
        assert len(embeddings) == 150
        assert list(embeddings[0]) == [0.1] * 768
        assert list(embeddings[100]) == [0.2] * 768
        
        # Verify that embed_content was called exactly twice
        assert mock_client_instance.models.embed_content.call_count == 2
        
        # Verify call arguments
        calls = mock_client_instance.models.embed_content.call_args_list
        # First call should have 100 contents
        assert len(calls[0][1]["contents"]) == 100
        # Second call should have 50 contents
        assert len(calls[1][1]["contents"]) == 50
