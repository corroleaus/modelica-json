within FromModelica;
block StringParameters
  "String parameters keep their quotes; a unit comes from a literal or from a parameter"
  parameter String quantityUnit = "W" "A string literal";
  parameter String unitAlias = quantityUnit "A reference to another String parameter";
  parameter String compoundUnit = "kg/s" "A literal that looks like a division";
  parameter String notABoolean = "true" "A literal that spells a Boolean";
  parameter Boolean isBoolean = true "A real Boolean";
  Buildings.Controls.OBC.CDL.Interfaces.RealInput uLit(unit="W")
    "Unit from a literal";
  Buildings.Controls.OBC.CDL.Interfaces.RealInput uRef(unit=quantityUnit)
    "Unit from a parameter: no unit can be written";
  Buildings.Controls.OBC.CDL.Interfaces.RealOutput y
    "Output";
equation
  connect(uLit, y);
end StringParameters;
