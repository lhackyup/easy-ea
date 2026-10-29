"""
Unit & Integration Tests for EasyEA Schema-as-Code (SaC) Engine
Tests DSL parsing, syntax validation, ArchiMate XML compilation, and round-trip fidelity.
"""

import pytest
from app.parsers.sac_parser import SaCParser, SaCParseError
from app.services.sac_service import SaCService
from app.parsers.archi_parser import ArchiModelParser


SAMPLE_EAC = """
schema "Digital Banking Architecture" {
    model_id: "sample-easybank-ea"
    version: "1.0"
    documentation: "Architettura dei canali digitali e dei servizi di pagamento"

    business {
        actor Customer "Cliente Consumer"
        process CheckoutProcess "Processo d'Ordine" [criticality: "Tier 1 - High"]
    }

    application {
        component MobileApp "Mobile Banking App" [time: "Invest", hosting: "Cloud - AWS", owner: "Mobile Team"]
        component PaymentGW "Core Payment Gateway" [time: "Tolerate", sla: "Gold (99.99%)", criticality: "Tier 0 - Mission Critical"]
        service PaymentService "Servizio Transazioni"
        data LedgerDB "Database Transazioni"
    }

    technology {
        node EKSCluster "Kubernetes EKS Cluster"
    }

    relationships {
        Customer -> CheckoutProcess : triggers
        CheckoutProcess -> PaymentService : serves
        MobileApp -> PaymentGW : flow "REST/JSON"
        PaymentGW -> PaymentService : realizes
        PaymentGW -> LedgerDB : access "Lettura e Scrittura"
        PaymentGW -> EKSCluster : assigned-to
    }

    layout {
        Customer: @pos(60, 60, 160, 65)
        CheckoutProcess: @pos(260, 60, 160, 65)
        MobileApp: @pos(60, 180, 160, 65)
        PaymentGW: @pos(260, 180, 160, 65)
        PaymentService: @pos(460, 180, 160, 65)
        LedgerDB: @pos(660, 180, 160, 65)
        EKSCluster: @pos(260, 320, 160, 65)
    }
}
"""


def test_sac_parser_valid():
    parser = SaCParser(SAMPLE_EAC)
    model = parser.parse()

    assert model.name == "Digital Banking Architecture"
    assert model.model_id == "sample-easybank-ea"
    assert model.version == "1.0"
    assert len(model.elements) == 7
    assert len(model.relationships) == 6
    assert len(model.layout) == 7

    # Check element details
    elem_map = {e["alias"]: e for e in model.elements}
    assert "MobileApp" in elem_map
    assert elem_map["MobileApp"]["type"] == "ApplicationComponent"
    assert elem_map["MobileApp"]["properties"]["TIME_Quadrant"] == "Invest"
    assert elem_map["MobileApp"]["properties"]["Hosting_Type"] == "Cloud - AWS"

    assert elem_map["Customer"]["type"] == "BusinessActor"
    assert elem_map["Customer"]["layer"] == "Business"

    assert elem_map["EKSCluster"]["type"] == "Node"
    assert elem_map["EKSCluster"]["layer"] == "Technology"


def test_sac_parser_syntax_error():
    invalid_eac = """
    schema "Broken" {
        business {
            invalid syntax here without quotes or type
        }
    }
    """
    parser = SaCParser(invalid_eac)
    with pytest.raises(SaCParseError):
        parser.parse()


def test_sac_compile_to_archimate_xml():
    xml_output = SaCService.compile_sac_to_archimate_xml(SAMPLE_EAC)

    assert "<?xml" in xml_output
    assert "<archimate:model" in xml_output
    assert 'name="Digital Banking Architecture"' in xml_output
    assert "BusinessActor" in xml_output
    assert "ApplicationComponent" in xml_output
    assert "FlowRelationship" in xml_output
    assert "DiagramObject" in xml_output
    assert "sourceConnection" in xml_output
    # Must contain targetConnections on receiving DiagramObject children
    assert "targetConnections=" in xml_output


def test_sac_target_connections_integrity():
    """Verify that all target nodes referenced in connections have valid targetConnections attribute."""
    from defusedxml.ElementTree import fromstring as safe_xml_fromstring
    xml_output = SaCService.compile_sac_to_archimate_xml(SAMPLE_EAC)
    root = safe_xml_fromstring(xml_output)

    # Collect all connection IDs and their target diagram object IDs
    conn_targets = {}
    for sc in root.iter("{http://www.archimatetool.com/archimate}sourceConnection"):
        c_id = sc.attrib.get("id")
        tgt_id = sc.attrib.get("target")
        assert c_id and tgt_id
        conn_targets.setdefault(tgt_id, []).append(c_id)

    # Find child diagram objects and check targetConnections
    for child in root.iter("{http://www.archimatetool.com/archimate}child"):
        ch_id = child.attrib.get("id")
        if ch_id in conn_targets:
            target_conns_attr = child.attrib.get("targetConnections", "")
            for expected_conn in conn_targets[ch_id]:
                assert expected_conn in target_conns_attr, f"Connection {expected_conn} missing in targetConnections of node {ch_id}"


def test_sac_roundtrip_fidelity():
    # 1. Compile SaC -> ArchiMate XML
    xml_output = SaCService.compile_sac_to_archimate_xml(SAMPLE_EAC)

    # 2. Verify with standard ArchiModelParser
    archi_parser = ArchiModelParser(xml_output)
    parsed_archi = archi_parser.parse()
    assert len(parsed_archi["elements"]) == 7
    assert len(parsed_archi["relationships"]) == 6

    # 3. Decompile ArchiMate XML -> SaC (.eac)
    decompiled_eac = SaCService.decompile_schema_to_sac(raw_xml=xml_output, include_layout=True)
    assert 'schema "Digital Banking Architecture"' in decompiled_eac
    assert "MobileApp" in decompiled_eac or "Mobile_Banking_App" in decompiled_eac
    assert "relationships {" in decompiled_eac

    # 4. Re-compile the decompiled SaC to confirm it parses cleanly
    re_parsed = SaCParser(decompiled_eac).parse()
    assert len(re_parsed.elements) == 7
    assert len(re_parsed.relationships) == 6
