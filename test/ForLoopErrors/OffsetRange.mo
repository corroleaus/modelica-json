within ForLoopErrors;
block OffsetRange "A range that does not start at 1"
  parameter Integer n = 2;
  Buildings.Controls.OBC.CDL.Interfaces.RealInput u[n];
  Buildings.Controls.OBC.CDL.Interfaces.RealOutput y[n];
  Buildings.Controls.OBC.CDL.Reals.Sources.Constant con(k=1);
  Buildings.Controls.OBC.CDL.Reals.MultiplyByParameter gai[n](each k=2);
equation
  for i in 2:n loop
    connect(u[i], gai[i].u);
  end for;
end OffsetRange;
