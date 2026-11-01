import pytest
import sys
import os
import json
from unittest.mock import AsyncMock, patch

# Ensure mcp-server is in python path for test
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "mcp-server")))

from server import (
    mcp,
    list_workspaces,
    search_archimate_elements,
    get_element_details,
    analyze_impact,
    get_apm_portfolio,
    audit_model_governance,
    create_adr_draft,
    list_adrs
)


@pytest.mark.asyncio
async def test_mcp_tools_registration():
    """Verifica che tutti i tool approvati siano registrati sul server FastMCP."""
    tool_names = [t.name for t in await mcp.list_tools()]
    assert "list_workspaces" in tool_names
    assert "search_archimate_elements" in tool_names
    assert "get_element_details" in tool_names
    assert "get_element_relationships" in tool_names
    assert "analyze_impact" in tool_names
    assert "get_apm_portfolio" in tool_names
    assert "get_resilience_and_spof_analysis" in tool_names
    assert "audit_model_governance" in tool_names
    assert "list_adrs" in tool_names
    assert "get_adr_details" in tool_names
    assert "create_adr_draft" in tool_names


@pytest.mark.asyncio
async def test_mcp_search_and_element_tools():
    """Verifica l'esecuzione dei tool di ricerca ed estrazione dettagli."""
    mock_elements = [
        {"id": "elem-1", "name": "Payment Gateway", "type": "ApplicationComponent", "layer": "Application"}
    ]
    mock_detail = {
        "id": "elem-1",
        "name": "Payment Gateway",
        "type": "ApplicationComponent",
        "layer": "Application",
        "properties": {"eea_time_quadrant": "Invest"}
    }

    with patch("server.ea_client.search_elements", new_callable=AsyncMock) as mock_search, \
         patch("server.ea_client.get_element", new_callable=AsyncMock) as mock_get:
        
        mock_search.return_value = mock_elements
        mock_get.return_value = mock_detail

        # 1. Search tool
        res_search_str = await search_archimate_elements(query="Payment")
        res_search = json.loads(res_search_str)
        assert len(res_search) == 1
        assert res_search[0]["name"] == "Payment Gateway"

        # 2. Detail tool
        res_detail_str = await get_element_details(element_id="elem-1")
        res_detail = json.loads(res_detail_str)
        assert res_detail["id"] == "elem-1"
        assert res_detail["properties"]["eea_time_quadrant"] == "Invest"


@pytest.mark.asyncio
async def test_mcp_impact_analysis_tool():
    """Verifica il calcolo dell'albero di impatto architetturale nel grafo."""
    mock_rels = [
        {
            "source_id": "elem-payment",
            "target_id": "elem-database",
            "type": "Serving",
            "source": {"name": "Payment Service", "type": "ApplicationComponent"},
            "target": {"name": "Oracle DB", "type": "Node"}
        },
        {
            "source_id": "elem-mobile-app",
            "target_id": "elem-payment",
            "type": "Serving",
            "source": {"name": "Mobile Banking", "type": "ApplicationComponent"},
            "target": {"name": "Payment Service", "type": "ApplicationComponent"}
        }
    ]

    with patch("server.ea_client.list_relationships", new_callable=AsyncMock) as mock_rels_call:
        mock_rels_call.return_value = mock_rels

        res_impact_str = await analyze_impact(element_id="elem-payment", depth=2, direction="both")
        res_impact = json.loads(res_impact_str)

        assert res_impact["root_element_id"] == "elem-payment"
        assert res_impact["total_impacted_elements"] == 2
        # Livello 1 deve contenere sia upstream che downstream
        lvl1 = res_impact["levels"][0]
        assert lvl1["impacted_count"] == 2


@pytest.mark.asyncio
async def test_mcp_create_adr_draft_tool():
    """Verifica la creazione assistita di una bozza ADR collegata a un componente."""
    mock_created_adr = {
        "id": "adr-101",
        "code": "ADR-005",
        "title": "Migrazione a Event-Driven Architecture",
        "status": "Draft",
        "domain": "Application"
    }

    with patch("server.ea_client.create_adr", new_callable=AsyncMock) as mock_adr_create:
        mock_adr_create.return_value = mock_created_adr

        res_adr_str = await create_adr_draft(
            title="Migrazione a Event-Driven Architecture",
            context_and_problem="Elevata latenza nelle comunicazioni sincrone",
            decision_outcome="Adozione broker Kafka per il disaccoppiamento",
            linked_element_id="elem-payment"
        )
        res_adr = json.loads(res_adr_str)

        assert res_adr["id"] == "adr-101"
        assert res_adr["status"] == "Draft"
        mock_adr_create.assert_called_once()
