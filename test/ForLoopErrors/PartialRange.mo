within ForLoopErrors;
block PartialRange "A range that covers only part of the arrays"
  parameter Integer n = 2;
  Buildings.Controls.OBC.CDL.Interfaces.RealInput u[n];
  Buildings.Controls.OBC.CDL.Interfaces.RealOutput y[n];
  Buildings.Controls.OBC.CDL.Reals.Sources.Constant con(k=1);
  Buildings.Controls.OBC.CDL.Reals.MultiplyByParameter gai[n](each k=2);
equation
  for i in 1:n-1 loop
    connect(u[i], gai[i].u);
  end for;
end PartialRange;
